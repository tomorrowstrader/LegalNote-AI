import type { Express, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import puppeteer from "puppeteer";

// Helper to resolve template paths in both dev and production
function resolveTemplatePath(filename: string): string {
  // Try multiple possible locations - prioritize cwd for Autoscale deployments
  const possiblePaths = [
    path.resolve(process.cwd(), 'public', filename),          // Works in both dev & production (cwd = project root)
    path.resolve(__dirname, '../public', filename),           // Development fallback
    path.resolve(__dirname, '../templates', filename),        // Alternative production location
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log(`[TEMPLATE] Found ${filename} at ${p}`);
      return p;
    }
  }
  
  console.error(`[TEMPLATE] Could not find ${filename}. Checked: ${possiblePaths.join(', ')}`);
  // Default to first path (will error if not found)
  return possiblePaths[0];
}
import { storage } from "./storage";
import { insertCaseSchema, insertAudioRecordingSchema, insertConsentLogSchema, insertTranscriptSchema, insertDocumentSchema, insertFirmProfileSchema } from "@shared/schema";
import { z } from "zod";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { chunkedUploadService } from "./services/chunkedUploadService";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { MAX_AUDIO_SIZE_BYTES } from "./uploadSecurity";
import {
  generalApiLimiter,
  caseCreationLimiter,
  presignedUrlLimiter,
  audioUploadLimiter,
  authLimiter,
  pollingLimiter,
} from "./rateLimiting";
import { auditLogger, AuditEventType } from "./auditLog";
import { logAuditEvent, auditMiddleware } from "./auditMiddleware";
import { openaiService } from "./openaiService";
import { sendCaseEmail, sendRecordingConfirmationEmail } from "./email";
import { generateSignedAuditPDF } from "./services/signedAuditExport";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, getConnectedProviders } from "./calendar";
import { isReplitCalendarConnected, createReplitCalendarEvent, updateReplitCalendarEvent, deleteReplitCalendarEvent } from "./replitCalendar";
import { isReplitOutlookConnected, createReplitOutlookEvent, updateReplitOutlookEvent, deleteReplitOutlookEvent, getOutlookUserEmail } from "./replitOutlook";
import { sendVerificationCode, generateVerificationCode, formatUKPhoneNumber } from "./sms";
import {
  createGoogleOAuthClient,
  getGoogleAuthUrl,
  exchangeGoogleCode,
  generateOAuthState,
  signOAuthState,
  verifyOAuthState,
  generateSecureNonce,
  type OAuthStatePayload,
} from "./oauth";
import bcrypt from "bcrypt";
import { stripeService } from "./stripeService";
import { getStripePublishableKey, getUncachableStripeClient } from "./stripeClient";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REFERRAL_CODES: Record<string, { code: string; description: string; discount: string; source: string; stripePromoCode?: string }> = {
  LINKEDIN25: {
    code: "LINKEDIN25",
    description: "LinkedIn exclusive: 25% off your first quarter",
    discount: "25% off first quarter",
    source: "linkedin",
    stripePromoCode: "LINKEDIN25",
  },
};

function validateReferralCode(code: string): typeof REFERRAL_CODES[string] | null {
  const normalized = code?.toUpperCase()?.trim();
  return REFERRAL_CODES[normalized] || null;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint for deployment platform
  // Must be before auth middleware and CORS is configured to allow requests without origin
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'LegalNote AI', timestamp: new Date().toISOString() });
  });

  // Setup Replit Auth
  await setupAuth(app);

  // Apply general rate limiting to all API routes (except polling endpoints)
  app.use('/api/', (req, res, next) => {
    // Skip general rate limiter for polling endpoints - they have their own lenient limits
    if (req.path.includes('/processing-status')) {
      return next();
    }
    generalApiLimiter(req, res, next);
  });

  // PUBLIC ROUTES (no authentication required)
  
  // Lead magnet PDF download (public - accessed after form submission)
  app.get('/api/lead-magnet/download', generalApiLimiter, async (req, res, next) => {
    try {
      console.log('[LEAD-MAGNET] PDF download requested');
      const firstName = req.query.name as string | undefined;
      const { generateDefensibleRecordPDF } = await import('./services/leadMagnetPdf');
      console.log('[LEAD-MAGNET] Generating PDF...');
      const pdfBuffer = generateDefensibleRecordPDF({ recipientName: firstName || undefined });
      console.log('[LEAD-MAGNET] PDF generated successfully, size:', pdfBuffer.length);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="LegalNote-Defensible-Record-Guide.pdf"');
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error('[LEAD-MAGNET] PDF generation error:', error?.message || error, error?.stack);
      next(error);
    }
  });

  // Serve the one-pager HTML explicitly
  app.get('/legalnote-one-pager.html', (req, res) => {
    res.sendFile(resolveTemplatePath('legalnote-one-pager.html'));
  });

  // Direct download for one-pager HTML
  app.get('/download-one-pager', (req, res) => {
    res.download(resolveTemplatePath('legalnote-one-pager.html'), 'LegalNote-One-Pager.html');
  });

  // Serve the mobile-friendly PDF download page
  app.get('/download-zahra-pdf', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'download-zahra-pdf.html'));
  });

  // LinkedIn Post Performance Tracking API
  app.get('/api/linkedin-performance', async (req, res, next) => {
    try {
      const data = await storage.getAllLinkedinPostPerformance();
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/linkedin-performance/:postNumber', async (req, res, next) => {
    try {
      const postNumber = parseInt(req.params.postNumber);
      const data = await storage.getLinkedinPostPerformance(postNumber);
      res.json(data || null);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/linkedin-performance', async (req, res, next) => {
    try {
      const body = { ...req.body };
      if (body.postedAt && typeof body.postedAt === 'string') {
        body.postedAt = new Date(body.postedAt);
      }
      const data = await storage.upsertLinkedinPostPerformance(body);
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/linkedin-post-chat', async (req, res, next) => {
    try {
      const { postNumber, currentContent, theme, message, history } = req.body;
      if (!postNumber || !currentContent || !message) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const { openaiClient } = await import('./config/openai');

      const messages: any[] = [
        {
          role: 'system' as const,
          content: `You are helping refine a LinkedIn post for a legal tech founder. The post is part of a 60-day content calendar for LegalNote, a compliance-first legal documentation platform.

Your role:
- Help edit, improve, or discuss the post content based on the user's request
- Maintain the authentic voice and tone - this is personal brand content, not corporate
- Keep posts within LinkedIn best practices (hook in first line, conversational, ends with PS question)
- When providing an amended version, output ONLY the full amended post text with no extra commentary
- When discussing/giving feedback, be concise and actionable

The user may ask you to:
1. Make specific edits to the post
2. Discuss whether something works well
3. Suggest improvements
4. Rewrite sections
5. Adjust tone or length

Current post #${postNumber}: "${theme}"

If the user asks for an edit or amendment, respond with JSON: {"type":"edit","content":"<full amended post>","explanation":"<brief note on what changed>"}
If the user asks a question or wants discussion, respond with JSON: {"type":"discussion","response":"<your response>"}`
        }
      ];

      if (history && Array.isArray(history)) {
        history.forEach((h: any) => {
          if ((h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string') {
            messages.push({ role: h.role, content: h.content });
          }
        });
      }

      messages.push({
        role: 'user' as const,
        content: `Current post content:\n\n${currentContent}\n\nMy request: ${message}`
      });

      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages,
        response_format: { type: 'json_object' },
        max_completion_tokens: 4096,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/linkedin-post-chat/:postNumber', async (req, res, next) => {
    try {
      const postNumber = parseInt(req.params.postNumber);
      if (isNaN(postNumber)) return res.status(400).json({ error: 'Invalid post number' });
      const messages = await storage.getChatMessages(postNumber);
      res.json(messages);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/linkedin-post-chat/message', async (req, res, next) => {
    try {
      const { postNumber, role, content, parsedType, parsedContent, parsedExplanation, parsedResponse } = req.body;
      if (!postNumber || !role || !content) return res.status(400).json({ error: 'Missing required fields' });
      const msg = await storage.addChatMessage({
        postNumber,
        role,
        content,
        parsedType: parsedType || null,
        parsedContent: parsedContent || null,
        parsedExplanation: parsedExplanation || null,
        parsedResponse: parsedResponse || null,
      });
      res.json(msg);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/linkedin-post-chat/:postNumber', async (req, res, next) => {
    try {
      const postNumber = parseInt(req.params.postNumber);
      if (isNaN(postNumber)) return res.status(400).json({ error: 'Invalid post number' });
      await storage.clearChatMessages(postNumber);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Connection milestones
  app.get('/api/linkedin-connections', async (req, res, next) => {
    try {
      const milestones = await storage.getConnectionMilestones();
      res.json(milestones);
    } catch (error) { next(error); }
  });

  app.post('/api/linkedin-connections', async (req, res, next) => {
    try {
      const { date, connectionCount, notes } = req.body;
      if (!date || connectionCount === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const milestone = await storage.addConnectionMilestone({
        date: new Date(date),
        connectionCount,
        notes: notes || null,
      });
      res.json(milestone);
    } catch (error) { next(error); }
  });

  app.delete('/api/linkedin-connections/:id', async (req, res, next) => {
    try {
      await storage.deleteConnectionMilestone(req.params.id);
      res.json({ success: true });
    } catch (error) { next(error); }
  });

  // Inbound leads
  app.get('/api/linkedin-leads', async (req, res, next) => {
    try {
      const leads = await storage.getInboundLeads();
      res.json(leads);
    } catch (error) { next(error); }
  });

  app.post('/api/linkedin-leads', async (req, res, next) => {
    try {
      const { name, company, linkedinUrl, triggerPostNumber, leadType, notes } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }
      const lead = await storage.addInboundLead({
        name,
        company: company || null,
        linkedinUrl: linkedinUrl || null,
        triggerPostNumber: triggerPostNumber || null,
        leadType: leadType || null,
        notes: notes || null,
      });
      res.json(lead);
    } catch (error) { next(error); }
  });

  app.delete('/api/linkedin-leads/:id', async (req, res, next) => {
    try {
      await storage.deleteInboundLead(req.params.id);
      res.json({ success: true });
    } catch (error) { next(error); }
  });

  // Hook variants
  app.get('/api/linkedin-hooks/:postNumber', async (req, res, next) => {
    try {
      const postNumber = parseInt(req.params.postNumber);
      const variants = await storage.getHookVariants(postNumber);
      res.json(variants);
    } catch (error) { next(error); }
  });

  app.post('/api/linkedin-hooks/generate', async (req, res, next) => {
    try {
      const { postNumber, currentHook, theme } = req.body;
      if (!postNumber || !currentHook) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const { openaiClient } = await import('./config/openai');
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Generate 3 alternative LinkedIn post hooks (opening lines) for a legal tech founder. Each hook must be 8 words or fewer. The hooks should be punchy, attention-grabbing, and follow the "How I" > "How to" principle. Return JSON: {"hooks":["hook1","hook2","hook3"]}`
          },
          {
            role: 'user',
            content: `Current hook: "${currentHook}"\nPost theme: "${theme || 'LegalNote legal tech'}"\n\nGenerate 3 alternative hooks.`
          }
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 500,
      });
      const result = JSON.parse(response.choices[0].message.content || '{"hooks":[]}');
      for (const hook of result.hooks) {
        await storage.addHookVariant({ postNumber, variant: hook, used: false });
      }
      const allVariants = await storage.getHookVariants(postNumber);
      res.json(allVariants);
    } catch (error) { next(error); }
  });

  app.delete('/api/linkedin-hooks/:id', async (req, res, next) => {
    try {
      await storage.deleteHookVariant(req.params.id);
      res.json({ success: true });
    } catch (error) { next(error); }
  });

  // Voice consistency scoring
  app.post('/api/linkedin-voice-check', async (req, res, next) => {
    try {
      const { content, voice } = req.body;
      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }
      const { openaiClient } = await import('./config/openai');
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a content consistency checker for a legal tech founder's LinkedIn content. The founder has four voices:
1. Client Who Got Burned - personal experience with bad legal documentation
2. Compliance Professional - corporate background at Clifford Chance, Coutts, Lloyd's, Standard Chartered
3. Obsessed Vibe Coder - passion for building, technical craftsmanship
4. Father Building Something - responsibility, legacy, defensibility

Score the content on: authenticity (1-10), voice consistency with the stated voice (1-10), LinkedIn best practices (1-10), engagement potential (1-10).
Provide brief actionable feedback.
Return JSON: {"scores":{"authenticity":N,"voiceConsistency":N,"linkedinBestPractices":N,"engagementPotential":N},"overall":N,"feedback":"brief feedback","strengths":["strength1"],"improvements":["improvement1"]}`
          },
          {
            role: 'user',
            content: `Voice: ${voice || 'Not specified'}\n\nContent:\n${content}`
          }
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 1000,
      });
      const result = JSON.parse(response.choices[0].message.content || '{}');
      res.json(result);
    } catch (error) { next(error); }
  });

  // Engagement prompts
  app.post('/api/linkedin-engagement-prompts', async (req, res, next) => {
    try {
      const { content, theme } = req.body;
      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }
      const { openaiClient } = await import('./config/openai');
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You help a legal tech founder engage with comments on their LinkedIn posts. Given a post, generate 4 suggested reply templates for common comment types they might receive. Each reply should be warm, authentic, and encourage further conversation. Return JSON: {"prompts":[{"commentType":"type","suggestedReply":"reply"},...]}`
          },
          {
            role: 'user',
            content: `Post theme: ${theme || 'Legal tech'}\n\nPost content:\n${content}`
          }
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 1000,
      });
      const result = JSON.parse(response.choices[0].message.content || '{"prompts":[]}');
      res.json(result);
    } catch (error) { next(error); }
  });

  // Campaign dashboard summary
  app.get('/api/linkedin-dashboard', async (req, res, next) => {
    try {
      const [allPerf, milestones, leads] = await Promise.all([
        storage.getAllLinkedinPostPerformance(),
        storage.getConnectionMilestones(),
        storage.getInboundLeads(),
      ]);

      const posted = allPerf.filter(p => p.postedAt);
      const totalImpressions = posted.reduce((s, p) => s + (p.impressions7d || p.impressions24h || p.impressions60m || 0), 0);
      const totalReactions = posted.reduce((s, p) => s + (p.reactions7d || p.reactions24h || p.reactions60m || 0), 0);
      const totalComments = posted.reduce((s, p) => s + (p.comments7d || p.comments24h || p.comments60m || 0), 0);
      const totalReposts = posted.reduce((s, p) => s + (p.reposts7d || p.reposts24h || p.reposts60m || 0), 0);
      const totalSaves = posted.reduce((s, p) => s + (p.saves7d || p.saves24h || p.saves60m || 0), 0);
      const totalFollowersGained = posted.reduce((s, p) => s + (p.followersGained7d || p.followersGained24h || p.followersGained60m || 0), 0);
      const totalProfileViewers = posted.reduce((s, p) => s + (p.profileViewers7d || p.profileViewers24h || p.profileViewers60m || 0), 0);

      const avgImpressions = posted.length > 0 ? Math.round(totalImpressions / posted.length) : 0;
      const avgReactions = posted.length > 0 ? Math.round(totalReactions / posted.length) : 0;

      const bestPost = posted.length > 0
        ? posted.reduce((best, p) => {
            const score = (p.impressions7d || 0) + (p.reactions7d || 0) * 5 + (p.comments7d || 0) * 10 + (p.reposts7d || 0) * 15;
            const bestScore = (best.impressions7d || 0) + (best.reactions7d || 0) * 5 + (best.comments7d || 0) * 10 + (best.reposts7d || 0) * 15;
            return score > bestScore ? p : best;
          })
        : null;

      const latestConnection = milestones.length > 0 ? milestones[0].connectionCount : 0;

      const bestTimeData: Record<string, { count: number; totalImpressions: number }> = {};
      posted.forEach(p => {
        if (p.postedAt) {
          const date = new Date(p.postedAt);
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const day = days[date.getDay()];
          const hour = date.getHours();
          const timeSlot = hour < 9 ? 'Early' : hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
          const key = `${day} ${timeSlot}`;
          if (!bestTimeData[key]) bestTimeData[key] = { count: 0, totalImpressions: 0 };
          bestTimeData[key].count++;
          bestTimeData[key].totalImpressions += (p.impressions7d || p.impressions24h || p.impressions60m || 0);
        }
      });

      let bestTime = 'Not enough data';
      let bestTimeAvg = 0;
      Object.entries(bestTimeData).forEach(([key, val]) => {
        const avg = val.totalImpressions / val.count;
        if (avg > bestTimeAvg) {
          bestTimeAvg = avg;
          bestTime = key;
        }
      });

      const currentPhase = posted.length <= 8 ? 1 : posted.length <= 16 ? 2 : posted.length <= 24 ? 3 : 4;
      const phaseNames = ['Origin & Credibility', 'Problem & Pain', 'Vision & Proof', 'Authority & Community'];

      res.json({
        postsPublished: posted.length,
        totalPosts: 32,
        currentPhase,
        phaseName: phaseNames[currentPhase - 1],
        totalImpressions,
        totalReactions,
        totalComments,
        totalReposts,
        totalSaves,
        totalFollowersGained,
        totalProfileViewers,
        avgImpressions,
        avgReactions,
        bestPost: bestPost ? { postNumber: bestPost.postNumber, impressions: bestPost.impressions7d || bestPost.impressions24h || bestPost.impressions60m || 0 } : null,
        currentConnections: latestConnection,
        totalLeads: leads.length,
        bestTime: bestTime !== 'Not enough data' ? bestTime : null,
        bestTimeAvgImpressions: Math.round(bestTimeAvg),
        weekProgress: Math.ceil(posted.length / 4),
      });
    } catch (error) { next(error); }
  });

  // Serve the 60-day LinkedIn content calendar
  app.get('/content-calendar', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'content-calendar.html'));
  });

  // Serve pre-generated static PDFs with download headers for mobile compatibility
  app.get('/static-pdf/:filename', (req, res) => {
    const filename = req.params.filename;
    const safeName = filename.replace(/[^a-zA-Z0-9\-_.]/g, '');
    const filePath = path.join(process.cwd(), 'public', safeName);
    
    if (!safeName.endsWith('.pdf')) {
      return res.status(400).json({ message: 'Invalid file type' });
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(filePath, (err) => {
      if (err) {
        res.status(404).json({ message: 'PDF not found' });
      }
    });
  });

  // Direct download for one-pager PDF with optional personalization
  // Usage: /download-one-pager-pdf?name=Sophie%20Akehurst
  app.get('/download-one-pager-pdf', async (req, res) => {
    try {
      const htmlPath = resolveTemplatePath('legalnote-one-pager.html');
      const recipientName = req.query.name as string | undefined;
      
      // Read the HTML file
      let htmlContent = await fs.promises.readFile(htmlPath, 'utf-8');
      
      // If a recipient name is provided, personalize the content
      if (recipientName && recipientName.trim()) {
        const fullName = recipientName.trim();
        const firstName = fullName.split(' ')[0];
        
        // Replace placeholders with actual values
        htmlContent = htmlContent.replace('{{RECIPIENT_FULL_NAME}}', fullName);
        htmlContent = htmlContent.replace('{{RECIPIENT_FIRST_NAME}}', firstName);
        
        // Make personalization elements visible
        htmlContent = htmlContent.replace(
          'class="personalization-top"',
          'class="personalization-top visible"'
        );
        htmlContent = htmlContent.replace(
          'class="personalization-bottom"',
          'class="personalization-bottom visible"'
        );
      }
      
      const browser = await puppeteer.launch({
        headless: true,
        executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      
      const page = await browser.newPage();
      
      // Set the base URL so relative assets work correctly
      await page.setContent(htmlContent, { 
        waitUntil: 'networkidle0'
      });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
      });
      
      await browser.close();
      
      // Generate filename with recipient name if provided
      const filename = recipientName 
        ? `LegalNote-One-Pager-${recipientName.trim().replace(/\s+/g, '-')}.pdf`
        : 'LegalNote-One-Pager.pdf';
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.end(Buffer.from(pdfBuffer), 'binary');
    } catch (error) {
      console.error('PDF generation error:', error);
      res.status(500).json({ message: 'Failed to generate PDF' });
    }
  });

  // Helper function to sanitize HTML input to prevent XSS/injection
  const sanitizeHtml = (input: string): string => {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  };

  // Download Compliance Trap Checklist PDF with optional personalization
  // Usage: /download-compliance-checklist-pdf?name=Sophie%20Akehurst
  app.get('/download-compliance-checklist-pdf', async (req, res) => {
    try {
      const htmlPath = resolveTemplatePath('compliance-trap-checklist.html');
      const recipientNameRaw = req.query.name as string | undefined;
      const recipientName = recipientNameRaw ? sanitizeHtml(recipientNameRaw) : undefined;
      
      let htmlContent = await fs.promises.readFile(htmlPath, 'utf-8');
      
      if (recipientName && recipientName.trim()) {
        const fullName = recipientName.trim();
        const firstName = fullName.split(' ')[0];
        
        htmlContent = htmlContent.replace(/\{\{RECIPIENT_FULL_NAME\}\}/g, fullName);
        htmlContent = htmlContent.replace(/\{\{RECIPIENT_FIRST_NAME\}\}/g, firstName);
        
        htmlContent = htmlContent.replace(
          'class="personalization-top"',
          'class="personalization-top visible"'
        );
        htmlContent = htmlContent.replace(
          'class="personalization-bottom"',
          'class="personalization-bottom visible"'
        );
      }
      
      const browser = await puppeteer.launch({
        headless: true,
        executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
      });
      
      await browser.close();
      
      const filename = recipientName 
        ? `LegalNote-Compliance-Checklist-${recipientName.trim().replace(/\s+/g, '-')}.pdf`
        : 'LegalNote-Compliance-Checklist.pdf';
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.end(Buffer.from(pdfBuffer), 'binary');
    } catch (error) {
      console.error('PDF generation error:', error);
      res.status(500).json({ message: 'Failed to generate PDF' });
    }
  });

  // Download Compliance Audit Report PDF with personalization
  // Usage: /download-compliance-audit-pdf?name=Sophie%20Akehurst&firm=Smith%20%26%20Co%20Solicitors
  app.get('/download-compliance-audit-pdf', async (req, res) => {
    try {
      const htmlPath = resolveTemplatePath('compliance-audit-report.html');
      const recipientNameRaw = req.query.name as string | undefined;
      const firmNameRaw = req.query.firm as string | undefined;
      const recipientName = recipientNameRaw ? sanitizeHtml(recipientNameRaw) : undefined;
      const firmName = firmNameRaw ? sanitizeHtml(firmNameRaw) : undefined;
      
      let htmlContent = await fs.promises.readFile(htmlPath, 'utf-8');
      
      // Generate report metadata
      const reportDate = new Date().toLocaleDateString('en-GB', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
      const reportId = `LN-${Date.now().toString(36).toUpperCase()}`;
      
      // Replace template placeholders
      htmlContent = htmlContent.replace(/\{\{REPORT_DATE\}\}/g, reportDate);
      htmlContent = htmlContent.replace(/\{\{REPORT_ID\}\}/g, reportId);
      htmlContent = htmlContent.replace(/\{\{FIRM_NAME\}\}/g, firmName || '[Firm Name]');
      
      // Default sample scores (these would be customized per audit)
      htmlContent = htmlContent.replace(/\{\{HIGH_RISK_COUNT\}\}/g, '5');
      htmlContent = htmlContent.replace(/\{\{MEDIUM_RISK_COUNT\}\}/g, '4');
      htmlContent = htmlContent.replace(/\{\{COMPLIANT_COUNT\}\}/g, '1');
      htmlContent = htmlContent.replace(/\{\{TOTAL_AREAS\}\}/g, '10');
      htmlContent = htmlContent.replace(/\{\{RISK_SCORE\}\}/g, '68');
      htmlContent = htmlContent.replace(/\{\{RISK_DESCRIPTION\}\}/g, 
        'Elevated risk. Multiple compliance gaps identified that require prompt attention to reduce regulatory and liability exposure.');
      
      if (recipientName && recipientName.trim()) {
        const fullName = recipientName.trim();
        htmlContent = htmlContent.replace(/\{\{RECIPIENT_FULL_NAME\}\}/g, fullName);
        
        htmlContent = htmlContent.replace(
          'class="personalization-top"',
          'class="personalization-top visible"'
        );
      } else {
        htmlContent = htmlContent.replace(/\{\{RECIPIENT_FULL_NAME\}\}/g, '[Recipient Name]');
      }
      
      const browser = await puppeteer.launch({
        headless: true,
        executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
      });
      
      await browser.close();
      
      const safeFilename = firmName 
        ? `LegalNote-Compliance-Audit-${firmName.trim().replace(/[^a-zA-Z0-9]/g, '-')}.pdf`
        : 'LegalNote-Compliance-Audit-Report.pdf';
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      res.end(Buffer.from(pdfBuffer), 'binary');
    } catch (error) {
      console.error('PDF generation error:', error);
      res.status(500).json({ message: 'Failed to generate PDF' });
    }
  });
  
  // Referral/promo code validation endpoint (public)
  app.get('/api/waitlist/validate-code/:code', generalApiLimiter, async (req, res) => {
    const code = req.params.code?.toUpperCase();
    const result = validateReferralCode(code);
    if (result) {
      return res.json({ valid: true, code: result.code, description: result.description, discount: result.discount });
    }
    return res.json({ valid: false });
  });

  // Waitlist signup (public - no auth required)
  app.post('/api/waitlist', generalApiLimiter, async (req, res, next) => {
    try {
      const { email, firstName, lastName, firmName, firmSize, role, source, gdprConsent, marketingConsent, referralCode } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      if (!gdprConsent) {
        return res.status(400).json({ message: "GDPR consent is required to join the waitlist" });
      }
      
      // Check if email already exists
      const existing = await storage.getWaitlistEntryByEmail(email.toLowerCase());
      if (existing) {
        return res.status(409).json({ message: "This email is already on our waitlist" });
      }

      const validReferralCode = referralCode ? validateReferralCode(referralCode) : null;
      const effectiveSource = validReferralCode?.source || source || 'landing_page';
      
      // Create waitlist entry
      const entry = await storage.createWaitlistEntry({
        email: email.toLowerCase(),
        firstName: firstName || null,
        lastName: lastName || null,
        firmName: firmName || null,
        firmSize: firmSize || null,
        role: role || null,
        source: effectiveSource,
        status: 'pending',
        gdprConsent: true,
        marketingConsent: marketingConsent || false,
        ipAddress: req.ip || null,
        referralCode: validReferralCode?.code || null,
      });
      
      // Send confirmation email (or lead magnet if that's the source)
      let emailSent = false;
      let emailError: string | null = null;
      try {
        if (source === 'lead_magnet') {
          console.log('[WAITLIST] Sending lead magnet email to:', email);
          const { sendLeadMagnetEmail } = await import('./email');
          const { generateDefensibleRecordPDF } = await import('./services/leadMagnetPdf');
          console.log('[WAITLIST] Generating PDF for email attachment...');
          const pdfBuffer = generateDefensibleRecordPDF({ recipientName: firstName || undefined });
          console.log('[WAITLIST] PDF generated, size:', pdfBuffer.length, 'bytes');
          const result = await sendLeadMagnetEmail(email, firstName || 'there', pdfBuffer);
          console.log('[WAITLIST] Email result:', result);
          emailSent = result.success;
          if (!result.success) {
            emailError = result.error || 'Email delivery failed';
            console.error('[WAITLIST] Email failed:', emailError);
          }
        } else {
          const { sendWaitlistConfirmationEmail } = await import('./email');
          const result = await sendWaitlistConfirmationEmail(email, firstName || 'there');
          emailSent = result.success;
          if (!result.success) {
            emailError = result.error || 'Email delivery failed';
          }
        }
      } catch (err: any) {
        console.error('[WAITLIST] Failed to send confirmation email:', err);
        emailError = err.message || 'Email delivery failed';
        // Don't fail the request if email fails
      }
      
      // Send admin notification email (don't block on this)
      try {
        const { sendWaitlistAdminNotification } = await import('./email');
        sendWaitlistAdminNotification({
          email,
          firstName,
          lastName,
          firmName,
          firmSize,
          role,
          source
        }).catch(err => {
          console.error('[WAITLIST] Failed to send admin notification:', err);
        });
      } catch (err: any) {
        console.error('[WAITLIST] Error importing admin notification function:', err);
      }
      
      res.status(201).json({ 
        message: "You've been added to our early access waitlist",
        id: entry.id,
        emailSent,
        emailError
      });
    } catch (error) {
      next(error);
    }
  });
  
  // Get share link data (public access for clients)
  app.get('/api/share/:linkId', generalApiLimiter, async (req, res, next) => {
    try {
      const { linkId } = req.params;
      
      // Get share link from database
      const shareLink = await storage.getShareLink(linkId);
      
      if (!shareLink) {
        return res.status(404).json({ message: "Share link not found" });
      }
      
      // Check if link has expired
      if (new Date() > new Date(shareLink.expiresAt)) {
        return res.status(410).json({ message: "Share link has expired" });
      }
      
      // Check if SMS verification is required and not yet verified
      if (shareLink.smsProtection && !shareLink.smsVerified) {
        return res.json({
          requiresSmsVerification: true,
          recipientName: shareLink.recipientName,
          phoneNumber: shareLink.smsPhoneNumber,
        });
      }
      
      // Check if password protection is enabled and not yet verified
      if (shareLink.password) {
        // Check session for password verification
        const sessionKey = `share_password_verified_${linkId}`;
        if (!req.session || !req.session[sessionKey]) {
          return res.json({
            requiresPassword: true,
            recipientName: shareLink.recipientName,
          });
        }
      }
      
      // Get case data
      const caseData = await storage.getCase(shareLink.caseId, shareLink.createdBy);
      
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Get documents and filter based on sharedDocuments selection
      const allDocuments = await storage.getActiveDocumentsByCase(shareLink.caseId, shareLink.createdBy);
      const sharedDocs = shareLink.sharedDocuments || ["attendance_note"]; // Fallback for old links
      const documents = allDocuments.filter(doc => sharedDocs.includes(doc.type));
      
      // Get transcript only if explicitly shared
      const transcript = sharedDocs.includes("transcript") 
        ? await storage.getTranscriptByCase(shareLink.caseId, shareLink.createdBy)
        : null;
      
      // Get firm profile for PDF export branding
      const firmProfile = await storage.getFirmProfile();
      
      // Increment access count
      await storage.incrementShareLinkAccess(linkId);
      
      // Log access
      await storage.createAuditLog({
        eventType: "share_link_accessed",
        userId: shareLink.createdBy,
        caseId: shareLink.caseId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: {
          shareLinkId: linkId,
          recipientEmail: shareLink.recipientEmail,
          recipientName: shareLink.recipientName,
          accessCount: shareLink.accessCount + 1,
          documentsShared: sharedDocs,
          documentCount: documents.length,
        },
        severity: "info",
      });

      // Log individual document access by client
      for (const doc of documents) {
        await storage.createAuditLog({
          eventType: "document_viewed_by_client",
          userId: shareLink.createdBy,
          caseId: shareLink.caseId,
          documentId: doc.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          metadata: {
            shareLinkId: linkId,
            recipientEmail: shareLink.recipientEmail,
            recipientName: shareLink.recipientName,
            documentType: doc.type,
            accessLevel: shareLink.accessLevel,
          },
          severity: "info",
        });
      }

      if (transcript) {
        await storage.createAuditLog({
          eventType: "transcript_viewed_by_client",
          userId: shareLink.createdBy,
          caseId: shareLink.caseId,
          transcriptId: transcript.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          metadata: {
            shareLinkId: linkId,
            recipientEmail: shareLink.recipientEmail,
            recipientName: shareLink.recipientName,
            accessLevel: shareLink.accessLevel,
          },
          severity: "info",
        });
      }
      
      // Return case data with documents
      res.json({
        requiresSmsVerification: false,
        requiresPassword: false,
        caseData: {
          title: caseData.title,
          clientName: caseData.clientName,
          matterReference: caseData.matterReference,
          createdAt: caseData.createdAt,
        },
        documents: documents.map(doc => ({
          id: doc.id,
          type: doc.type,
          content: doc.content,
          version: doc.version,
          createdAt: doc.createdAt,
        })),
        transcript: transcript ? {
          id: transcript.id,
          content: transcript.content,
          createdAt: transcript.createdAt,
        } : null,
        shareLink: {
          recipientName: shareLink.recipientName,
          expiresAt: shareLink.expiresAt,
          accessLevel: shareLink.accessLevel,
          sharedDocuments: sharedDocs,
        },
        firmProfile: firmProfile || undefined,
      });
    } catch (error: any) {
      next(error);
    }
  });

  // Send SMS verification code (public access)
  app.post('/api/share/:linkId/send-sms', generalApiLimiter, async (req, res, next) => {
    try {
      const { linkId } = req.params;
      const { phoneNumber } = req.body;

      // Validate phone number is provided
      if (!phoneNumber || typeof phoneNumber !== 'string') {
        return res.status(400).json({ message: "Phone number is required" });
      }

      // Get share link
      const shareLink = await storage.getShareLink(linkId);
      
      if (!shareLink) {
        return res.status(404).json({ message: "Share link not found" });
      }

      // Check if link has expired
      if (new Date() > new Date(shareLink.expiresAt)) {
        return res.status(410).json({ message: "Share link has expired" });
      }

      // Check if SMS protection is enabled
      if (!shareLink.smsProtection) {
        return res.status(400).json({ message: "SMS verification is not required for this link" });
      }

      // Rate limiting: Check SMS send count (max 3 sends per link)
      if (shareLink.smsCodeSentCount >= 3) {
        return res.status(429).json({ message: "Maximum SMS send attempts exceeded for this link" });
      }

      // Format and validate phone number
      const formattedPhone = formatUKPhoneNumber(phoneNumber);

      // Check if phone number matches (if one was provided during link creation)
      if (shareLink.smsPhoneNumber && shareLink.smsPhoneNumber !== formattedPhone) {
        return res.status(403).json({ message: "Phone number does not match the expected recipient" });
      }

      // Generate verification code
      const verificationCode = generateVerificationCode();
      
      // Calculate expiry (15 minutes from now)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15);

      // Get firm profile for branded SMS
      const firmProfile = await storage.getFirmProfile();
      const firmName = firmProfile?.name || "LegalNote AI";

      // Send SMS
      const result = await sendVerificationCode(formattedPhone, verificationCode, firmName);

      if (!result.success) {
        return res.status(500).json({ message: result.error || "Failed to send SMS" });
      }

      // Store code in database
      await storage.updateShareLinkSmsCode(linkId, verificationCode, expiresAt);

      // Log SMS sent event
      await storage.createAuditLog({
        eventType: "sms_code_sent",
        userId: shareLink.createdBy,
        caseId: shareLink.caseId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: {
          shareLinkId: linkId,
          phoneNumber: formattedPhone.replace(/\d(?=\d{4})/g, '*'), // Mask phone number in logs
          expiresAt: expiresAt.toISOString(),
        },
        severity: "info",
      });

      res.json({ 
        success: true, 
        message: "Verification code sent successfully",
        expiresIn: 15, // minutes
      });
    } catch (error: any) {
      console.error('Error sending SMS:', error);
      next(error);
    }
  });

  // Verify SMS code (public access)
  app.post('/api/share/:linkId/verify-sms', generalApiLimiter, async (req, res, next) => {
    try {
      const { linkId } = req.params;
      const { code } = req.body;

      // Validate code is provided
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ message: "Verification code is required" });
      }

      // Get share link
      const shareLink = await storage.getShareLink(linkId);
      
      if (!shareLink) {
        return res.status(404).json({ message: "Share link not found" });
      }

      // Check if link has expired
      if (new Date() > new Date(shareLink.expiresAt)) {
        return res.status(410).json({ message: "Share link has expired" });
      }

      // Check if SMS protection is enabled
      if (!shareLink.smsProtection) {
        return res.status(400).json({ message: "SMS verification is not required for this link" });
      }

      // Rate limiting: Check verification attempts (max 5 attempts per link)
      if (shareLink.smsVerificationAttempts >= 5) {
        return res.status(429).json({ message: "Maximum verification attempts exceeded for this link" });
      }

      // Verify the code
      const verification = await storage.verifyShareLinkSmsCode(linkId, code);

      if (!verification.verified) {
        // Log failed verification
        await storage.createAuditLog({
          eventType: "sms_verification_failed",
          userId: shareLink.createdBy,
          caseId: shareLink.caseId,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          metadata: {
            shareLinkId: linkId,
            reason: verification.expired ? 'code_expired' : 'invalid_code',
          },
          severity: "warning",
        });

        if (verification.expired) {
          return res.status(400).json({ 
            message: "Verification code has expired. Please request a new code.",
            expired: true,
          });
        } else {
          return res.status(400).json({ 
            message: "Invalid verification code. Please try again.",
            invalid: true,
          });
        }
      }

      // Log successful verification
      await storage.createAuditLog({
        eventType: "sms_code_verified",
        userId: shareLink.createdBy,
        caseId: shareLink.caseId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: {
          shareLinkId: linkId,
        },
        severity: "info",
      });

      res.json({ 
        success: true, 
        message: "Phone number verified successfully" 
      });
    } catch (error: any) {
      console.error('Error verifying SMS:', error);
      next(error);
    }
  });

  // Verify password for share link (public access)
  app.post('/api/share/:linkId/verify-password', generalApiLimiter, async (req, res, next) => {
    try {
      const { linkId } = req.params;
      const { password } = req.body;

      // Validate password is provided
      if (!password || typeof password !== 'string') {
        return res.status(400).json({ message: "Password is required" });
      }

      // Get share link
      const shareLink = await storage.getShareLink(linkId);
      
      if (!shareLink) {
        return res.status(404).json({ message: "Share link not found" });
      }

      // Check if link has expired
      if (new Date() > new Date(shareLink.expiresAt)) {
        return res.status(410).json({ message: "Share link has expired" });
      }

      // Check if password protection is enabled
      if (!shareLink.password) {
        return res.status(400).json({ message: "Password protection is not enabled for this link" });
      }

      // Verify password - handle both legacy plaintext and bcrypt hashed passwords
      let isPasswordValid = false;
      const isLegacyPlaintext = !shareLink.password.startsWith('$2'); // bcrypt hashes start with $2
      
      if (isLegacyPlaintext) {
        // Legacy plaintext password - do direct comparison
        isPasswordValid = password === shareLink.password;
        
        // Migrate to hashed password on successful login
        if (isPasswordValid) {
          const saltRounds = 10;
          const hashedPassword = await bcrypt.hash(password, saltRounds);
          await storage.updateShareLink(linkId, { password: hashedPassword });
          console.log(`[SECURITY] Migrated legacy plaintext password to bcrypt hash for share link ${linkId}`);
        }
      } else {
        // Modern bcrypt hashed password
        isPasswordValid = await bcrypt.compare(password, shareLink.password);
      }
      
      if (!isPasswordValid) {
        // Log failed password attempt
        await storage.createAuditLog({
          eventType: "share_password_failed",
          userId: shareLink.createdBy,
          caseId: shareLink.caseId,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          metadata: {
            shareLinkId: linkId,
          },
          severity: "warning",
        });

        return res.status(401).json({ message: "Incorrect password" });
      }

      // Store password verification in session
      const sessionKey = `share_password_verified_${linkId}`;
      if (!req.session) {
        return res.status(500).json({ message: "Session not available" });
      }
      req.session[sessionKey] = true;

      // Log successful password verification
      await storage.createAuditLog({
        eventType: "share_password_verified",
        userId: shareLink.createdBy,
        caseId: shareLink.caseId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: {
          shareLinkId: linkId,
        },
        severity: "info",
      });

      res.json({ 
        success: true, 
        message: "Password verified successfully" 
      });
    } catch (error: any) {
      console.error('Error verifying password:', error);
      next(error);
    }
  });

  // Auth user route
  app.get('/api/auth/user', isAuthenticated, authLimiter, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      let user = await storage.getUser(userId);
      
      // If user not found in storage, upsert from claims (handles edge cases)
      if (!user) {
        user = await storage.upsertUser({
          id: req.user.claims.sub,
          email: req.user.claims.email,
          firstName: req.user.claims.first_name,
          lastName: req.user.claims.last_name,
          profileImageUrl: req.user.claims.profile_image_url,
        });
      }
      
      // Add admin flag to user object (MVP: configurable via env)
      const ADMIN_USER_ID = process.env.ADMIN_USER_ID || "48381245";
      const isAdmin = userId === ADMIN_USER_ID;
      
      // Check waitlist status for non-admin users
      let waitlistStatus: string | null = null;
      if (!isAdmin && user?.email) {
        const waitlistEntry = await storage.getWaitlistEntryByEmail(user.email);
        waitlistStatus = waitlistEntry?.status ?? null;
      }
      
      const userWithFlags = {
        ...user,
        isAdmin,
        waitlistStatus,
      };
      
      res.json(userWithFlags);
    } catch (error) {
      next(error);
    }
  });

  // ==================== STRIPE BILLING ROUTES ====================
  
  // Get Stripe publishable key (public route for checkout)
  app.get('/api/stripe/config', async (req, res, next) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      next(error);
    }
  });

  // Get products and prices (public for landing page)
  app.get('/api/stripe/products', async (req, res, next) => {
    try {
      const rows = await stripeService.listProductsWithPrices();
      
      // Group prices by product
      const productsMap = new Map();
      for (const row of rows as any[]) {
        if (!productsMap.has(row.product_id)) {
          productsMap.set(row.product_id, {
            id: row.product_id,
            name: row.product_name,
            description: row.product_description,
            active: row.product_active,
            metadata: row.product_metadata,
            prices: []
          });
        }
        if (row.price_id) {
          productsMap.get(row.product_id).prices.push({
            id: row.price_id,
            unit_amount: row.unit_amount,
            currency: row.currency,
            recurring: row.recurring,
            active: row.price_active,
            metadata: row.price_metadata,
          });
        }
      }

      res.json({ products: Array.from(productsMap.values()) });
    } catch (error) {
      next(error);
    }
  });

  // Get user's subscription status (authenticated)
  app.get('/api/subscription', isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.stripeSubscriptionId) {
        return res.json({ 
          subscription: null,
          status: user?.subscriptionStatus || null,
          plan: user?.subscriptionPlan || null,
          trialEndsAt: user?.trialEndsAt || null,
        });
      }

      const subscription = await stripeService.getSubscription(user.stripeSubscriptionId);
      res.json({ 
        subscription,
        status: user.subscriptionStatus,
        plan: user.subscriptionPlan,
        trialEndsAt: user.trialEndsAt,
      });
    } catch (error) {
      next(error);
    }
  });

  // Create checkout session
  app.post('/api/stripe/checkout', isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { priceId, trialDays } = req.body;

      if (!priceId) {
        return res.status(400).json({ message: 'priceId is required' });
      }

      let user = await storage.getUser(userId);
      
      // Create Stripe customer if not exists
      let customerId = user?.stripeCustomerId;
      if (!customerId) {
        const customer = await stripeService.createCustomer(
          user?.email || req.user.claims.email,
          userId,
          `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || undefined
        );
        await storage.updateUserStripeInfo(userId, { stripeCustomerId: customer.id });
        customerId = customer.id;
      }

      // Get base URL for redirects
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      const session = await stripeService.createCheckoutSession(
        customerId,
        priceId,
        `${baseUrl}/?checkout=success`,
        `${baseUrl}/?checkout=cancel`,
        trialDays
      );

      res.json({ url: session.url });
    } catch (error) {
      next(error);
    }
  });

  // Create customer portal session (manage subscription)
  app.post('/api/stripe/portal', isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user?.stripeCustomerId) {
        return res.status(400).json({ message: 'No subscription found' });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const session = await stripeService.createCustomerPortalSession(
        user.stripeCustomerId,
        `${baseUrl}/settings`
      );

      res.json({ url: session.url });
    } catch (error) {
      next(error);
    }
  });

  // ==================== END STRIPE BILLING ROUTES ====================

  // Protected Case routes
  app.post("/api/cases", isAuthenticated, caseCreationLimiter, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertCaseSchema.parse(req.body);
      
      // Security: Storage layer enforces user isolation
      const newCase = await storage.createCase(validatedData, userId);
      auditLogger.logFromRequest(AuditEventType.CASE_CREATED, req, {
        resourceId: newCase.id,
        resourceType: "case",
        action: "create",
        severity: "low",
      });
      res.json(newCase);
    } catch (error: any) {
      // Zod validation errors: return 400 with message
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.message });
      }
      // All other errors: use sanitized error handler
      next(error);
    }
  });

  app.get("/api/cases", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      // Include archived cases so the dashboard can show them in the Archived tab
      const includeArchived = req.query.includeArchived !== 'false';
      const cases = await storage.getCases(userId, includeArchived);
      res.json(cases);
    } catch (error: any) {
      next(error);
    }
  });

  // Dashboard attention stats - audio expiring soon
  app.get("/api/dashboard/attention-stats", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const audioExpiringCount = await storage.getExpiringAudioCount(userId, 24);
      res.json({ audioExpiringCount });
    } catch (error: any) {
      next(error);
    }
  });

  // Dashboard enhanced stats - productivity metrics
  app.get("/api/dashboard/productivity-stats", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getProductivityStats(userId);
      res.json(stats);
    } catch (error: any) {
      next(error);
    }
  });

  // Search cases
  app.get("/api/search", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const query = req.query.q as string;
      
      if (!query || query.trim().length === 0) {
        return res.json([]);
      }
      
      const cases = await storage.searchCases(query.trim(), userId);
      res.json(cases);
    } catch (error: any) {
      next(error);
    }
  });
  
  // Enhanced search with match details
  app.get("/api/search/enhanced", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const query = req.query.q as string;
      const documentType = req.query.type as 'transcript' | 'attendance_note' | 'summary' | 'all' | undefined;
      const dateRange = req.query.dateRange as 'today' | 'week' | 'month' | 'year' | 'all' | undefined;
      
      if (!query || query.trim().length === 0) {
        return res.json([]);
      }
      
      const results = await storage.searchCasesWithMatches(query.trim(), userId, {
        documentType: documentType || 'all',
        dateRange: dateRange || 'all',
      });
      
      res.json(results);
    } catch (error: any) {
      next(error);
    }
  });
  
  // Search history
  app.get("/api/search/history", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const history = await storage.getSearchHistory(userId, limit);
      res.json(history);
    } catch (error: any) {
      next(error);
    }
  });
  
  app.post("/api/search/history", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { query, resultCount } = req.body;
      
      if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: "Query is required" });
      }
      
      const historyEntry = await storage.createSearchHistory({
        userId,
        query: query.trim(),
        resultCount: resultCount || 0,
      });
      
      res.json(historyEntry);
    } catch (error: any) {
      next(error);
    }
  });
  
  app.delete("/api/search/history", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      await storage.clearSearchHistory(userId);
      res.json({ success: true });
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/cases/:id", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseData = await storage.getCase(req.params.id, userId);
      
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Log case view for audit trail
      await logAuditEvent(userId, "case_viewed", {
        caseId: req.params.id,
        metadata: { clientName: caseData.clientName, title: caseData.title },
        req,
      });
      
      res.json(caseData);
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/cases/:id/processing-status", isAuthenticated, pollingLimiter, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      const metadata = (caseData.aiProcessingMetadata as any) || {};
      
      res.json({
        status: caseData.status,
        processingMetadata: {
          status: metadata.status || 'not_started',
          progress: metadata.progress || 0,
          currentStep: metadata.currentStep || '',
          totalCost: metadata.totalCost || 0,
          totalTokens: metadata.totalTokens || 0,
          error: metadata.error,
          completedAt: metadata.completedAt,
        }
      });
    } catch (error: any) {
      next(error);
    }
  });

  // Case action routes
  app.post("/api/cases/:id/review", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { reviewed } = req.body;
      
      if (typeof reviewed !== 'boolean') {
        return res.status(400).json({ message: "reviewed field must be a boolean" });
      }
      
      const updatedCase = await storage.markCaseAsReviewed(req.params.id, reviewed, userId);
      
      if (!updatedCase) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      await logAuditEvent(userId, "case_updated", {
        caseId: req.params.id,
        metadata: { action: "mark_reviewed", reviewed },
        req,
      });
      
      res.json(updatedCase);
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/cases/:id/archive", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { archived } = req.body;
      
      if (typeof archived !== 'boolean') {
        return res.status(400).json({ message: "archived field must be a boolean" });
      }
      
      const updatedCase = await storage.archiveCase(req.params.id, archived, userId);
      
      if (!updatedCase) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      await logAuditEvent(userId, "case_updated", {
        caseId: req.params.id,
        metadata: { action: "archive", archived },
        req,
      });
      
      res.json(updatedCase);
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/cases/:id/assign", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { assignedToUserId } = req.body;
      
      if (assignedToUserId !== null && typeof assignedToUserId !== 'string') {
        return res.status(400).json({ message: "assignedToUserId must be a string or null" });
      }
      
      const updatedCase = await storage.assignCaseToUser(req.params.id, assignedToUserId, userId);
      
      if (!updatedCase) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      await logAuditEvent(userId, "case_updated", {
        caseId: req.params.id,
        metadata: { action: "assign", assignedToUserId },
        req,
      });
      
      res.json(updatedCase);
    } catch (error: any) {
      next(error);
    }
  });

  // Quick Notes routes
  app.post("/api/cases/:id/quick-notes", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { content } = req.body;

      if (!content || typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ message: "Content is required" });
      }

      // Verify case exists and belongs to user
      const caseRecord = await storage.getCase(req.params.id, userId);
      if (!caseRecord) {
        return res.status(404).json({ message: "Case not found" });
      }

      const quickNote = await storage.createQuickNote({
        caseId: req.params.id,
        content: content.trim(),
      }, userId);

      await logAuditEvent(userId, "quick_note_added", {
        caseId: req.params.id,
        metadata: { 
          noteLength: content.length,
          quickNoteId: quickNote.id,
        },
        req,
      });

      res.json(quickNote);
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/cases/:id/quick-notes", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const quickNotes = await storage.getQuickNotesByCase(req.params.id, userId);
      res.json(quickNotes);
    } catch (error: any) {
      next(error);
    }
  });

  app.patch("/api/cases/:id", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { priority, deadline, deadlineIsAllDay, textNotes } = req.body;
      
      // Get current case to verify access
      const currentCase = await storage.getCase(req.params.id, userId);
      if (!currentCase) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Build update object with only provided fields
      const updates: any = {};
      if (priority !== undefined) updates.priority = priority;
      if (deadline !== undefined) {
        // Store deadline as-is without normalization
        // The deadlineIsAllDay flag indicates how to interpret the timestamp
        updates.deadline = deadline ? new Date(deadline) : null;
      }
      if (deadlineIsAllDay !== undefined) updates.deadlineIsAllDay = deadlineIsAllDay;
      if (textNotes !== undefined) updates.textNotes = textNotes;
      
      // Update the case
      const updatedCase = await storage.updateCase(req.params.id, updates, userId);
      
      // Log specific audit events for different update types
      if (textNotes !== undefined) {
        await logAuditEvent(userId, "quick_note_added", {
          caseId: req.params.id,
          metadata: { 
            noteLength: textNotes?.length || 0,
            hasContent: !!textNotes?.trim(),
          },
          req,
        });
      }
      
      if (deadline !== undefined || deadlineIsAllDay !== undefined) {
        await logAuditEvent(userId, "deadline_changed", {
          caseId: req.params.id,
          metadata: { 
            deadline: deadline,
            deadlineIsAllDay: deadlineIsAllDay,
            priority: priority || currentCase.priority,
          },
          req,
        });
      }
      
      if (priority !== undefined) {
        await logAuditEvent(userId, "priority_changed", {
          caseId: req.params.id,
          metadata: { 
            oldPriority: currentCase.priority,
            newPriority: priority,
          },
          req,
        });
      }
      
      // General case update log
      await logAuditEvent(userId, "case_updated", {
        caseId: req.params.id,
        metadata: { updates },
        req,
      });
      
      res.json(updatedCase);
    } catch (error: any) {
      next(error);
    }
  });

  // Litigation Hold Management - Privileged operation for legal defensibility
  // This endpoint allows authorized users to apply or release litigation holds on cases
  // Litigation holds prevent automatic data deletion for cases involved in disputes
  app.post("/api/cases/:id/litigation-hold", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      
      const holdSchema = z.object({
        apply: z.boolean(),
        reason: z.string().min(10, "Reason must be at least 10 characters").max(2000).optional(),
      });
      
      const validationResult = holdSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation error",
          errors: validationResult.error.format()
        });
      }
      
      const { apply, reason } = validationResult.data;
      
      // Get current case to verify access
      const currentCase = await storage.getCase(req.params.id, userId);
      if (!currentCase) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Validate reason is provided when applying hold
      if (apply && !reason) {
        return res.status(400).json({ 
          message: "Reason is required when applying a litigation hold" 
        });
      }
      
      const updates: any = {
        litigationHold: apply,
      };
      
      if (apply) {
        updates.litigationHoldAppliedAt = new Date();
        updates.litigationHoldAppliedBy = userId;
        updates.litigationHoldReason = reason;
        // Clear release fields when applying a new hold
        updates.litigationHoldReleasedAt = null;
        updates.litigationHoldReleasedBy = null;
      } else {
        // When releasing, preserve who applied the hold but record who released it
        // This creates a complete audit trail of hold lifecycle
        updates.litigationHoldReleasedAt = new Date();
        updates.litigationHoldReleasedBy = userId;
        // Note: We preserve litigationHoldAppliedAt/By to maintain history
      }
      
      const updatedCase = await storage.updateCase(req.params.id, updates, userId);
      
      // Log audit event for litigation hold change - includes acting solicitor for defensibility
      const auditMetadata = apply 
        ? {
            reason: reason,
            appliedBy: userId,
            previousHoldStatus: (currentCase as any).litigationHold,
            clientName: currentCase.clientName,
            caseTitle: currentCase.title,
            actionTimestamp: new Date().toISOString(),
          }
        : {
            releasedBy: userId,
            originalAppliedBy: (currentCase as any).litigationHoldAppliedBy,
            originalAppliedAt: (currentCase as any).litigationHoldAppliedAt,
            previousHoldStatus: (currentCase as any).litigationHold,
            clientName: currentCase.clientName,
            caseTitle: currentCase.title,
            actionTimestamp: new Date().toISOString(),
          };
      
      await logAuditEvent(userId, apply ? "litigation_hold_applied" : "litigation_hold_released", {
        caseId: req.params.id,
        metadata: auditMetadata,
        severity: "critical", // Litigation holds are always critical events
        req,
      });
      
      res.json({
        success: true,
        litigationHold: apply,
        message: apply 
          ? "Litigation hold applied - automatic data deletion is now suspended for this case"
          : "Litigation hold released - normal retention policies will apply",
        updatedCase,
      });
    } catch (error: any) {
      next(error);
    }
  });

  // Document Review Workflow Routes
  app.post("/api/documents/:id/approve", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body with Zod
      const approveSchema = z.object({
        comment: z.string().trim().max(1000, "Comment too long").optional(),
      });
      
      const validationResult = approveSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation error",
          errors: validationResult.error.format()
        });
      }
      
      const { comment } = validationResult.data;
      
      const approvedDocument = await storage.approveDocument(req.params.id, userId, comment);
      
      if (!approvedDocument) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      res.json(approvedDocument);
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/documents/:id/unlock", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      
      // No request body validation needed for unlock (no body expected)
      const unlockedDocument = await storage.unlockDocument(req.params.id, userId);
      
      if (!unlockedDocument) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      res.json(unlockedDocument);
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/documents/:id/verify", isAuthenticated, async (req: any, res, next) => {
    try {
      const { verifyDocumentHash } = await import("./utils/documentHash");
      const userId = req.user.claims.sub;
      
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Verify user has access to the case
      const caseData = await storage.getCase(document.caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Verify document integrity
      const isValid = document.contentHash 
        ? verifyDocumentHash(document.content, document.contentHash)
        : false;
      
      res.json({
        documentId: document.id,
        verified: isValid,
        hasHash: !!document.contentHash,
        algorithm: "SHA-256",
        verifiedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      next(error);
    }
  });

  app.patch("/api/documents/:id", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body with Zod
      const updateDocumentSchema = z.object({
        content: z.string().min(1, "Content cannot be empty").max(100000, "Content too long"),
      });
      
      const validationResult = updateDocumentSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation error",
          errors: validationResult.error.format()
        });
      }
      
      const { content } = validationResult.data;
      
      // Get the document first to check if it exists and is a draft
      const existingDoc = await storage.getDocument(req.params.id);
      if (!existingDoc) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      if (existingDoc.status === 'approved') {
        return res.status(400).json({ 
          message: "Cannot edit approved documents. Unlock the document first." 
        });
      }
      
      // Update content and increment version
      const updatedDocument = await storage.updateDocument(
        req.params.id, 
        { 
          content,
          version: existingDoc.version + 1 
        }, 
        userId
      );
      
      if (!updatedDocument) {
        return res.status(404).json({ message: "Failed to update document" });
      }
      
      // Create audit log for document edit
      await storage.createAuditLog({
        eventType: 'document_edited',
        userId,
        caseId: existingDoc.caseId,
        documentId: req.params.id,
        metadata: {
          documentType: existingDoc.type,
          oldVersion: existingDoc.version,
          newVersion: updatedDocument.version,
          contentLength: content.length,
        },
      });
      
      res.json(updatedDocument);
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/cases/:caseId/document-versions/:type", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId, type } = req.params;
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      const allDocs = await storage.getDocumentsByCase(caseId, userId);
      const versions = allDocs
        .filter(d => d.type === type)
        .sort((a, b) => a.version - b.version);
      
      const versionsWithMeta = versions.map(doc => {
        const wordCount = doc.content.split(/\s+/).filter(Boolean).length;
        return {
          id: doc.id,
          version: doc.version,
          versionType: doc.versionType,
          content: doc.content,
          createdAt: doc.createdAt,
          createdBy: doc.createdBy,
          isActive: doc.isActive,
          status: doc.status,
          wordCount,
        };
      });
      
      res.json(versionsWithMeta);
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/documents/:id/comments", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      const caseData = await storage.getCase(document.caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Access denied" });
      }
      const comments = await storage.getDocumentComments(req.params.id);
      res.json(comments);
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/documents/:id/comments", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      const caseData = await storage.getCase(document.caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Access denied" });
      }
      const commentSchema = z.object({
        selectedText: z.string().min(1).max(10000),
        commentText: z.string().min(1).max(10000),
      });
      const validationResult = commentSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: "Validation error", errors: validationResult.error.format() });
      }
      const { selectedText, commentText } = validationResult.data;
      const comment = await storage.createDocumentComment({
        documentId: req.params.id,
        userId,
        selectedText,
        commentText,
        resolved: false,
      });
      await storage.createAuditLog({
        eventType: 'document_comment_added',
        userId,
        caseId: document.caseId,
        documentId: req.params.id,
        metadata: { selectedTextPreview: selectedText.substring(0, 100) },
      });
      res.json(comment);
    } catch (error: any) {
      next(error);
    }
  });

  app.patch("/api/documents/:id/comments/:commentId", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      const caseData = await storage.getCase(document.caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Access denied" });
      }
      const updateSchema = z.object({
        resolved: z.boolean().optional(),
        commentText: z.string().min(1).max(10000).optional(),
      });
      const validationResult = updateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: "Validation error", errors: validationResult.error.format() });
      }
      const updated = await storage.updateDocumentComment(req.params.commentId, validationResult.data);
      if (!updated) {
        return res.status(404).json({ message: "Comment not found" });
      }
      if (validationResult.data.resolved !== undefined) {
        await storage.createAuditLog({
          eventType: validationResult.data.resolved ? 'document_comment_resolved' : 'document_comment_reopened',
          userId,
          caseId: document.caseId,
          documentId: req.params.id,
          metadata: { commentId: req.params.commentId },
        });
      }
      res.json(updated);
    } catch (error: any) {
      next(error);
    }
  });

  app.delete("/api/documents/:id/comments/:commentId", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      const caseData = await storage.getCase(document.caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Access denied" });
      }
      await storage.deleteDocumentComment(req.params.commentId);
      res.json({ success: true });
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/cases/:id/email", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body with Zod
      const emailRequestSchema = z.object({
        recipientEmail: z.string().email("Invalid email address"),
        customMessage: z.string().max(5000, "Message too long").optional(),
      });
      
      const validationResult = emailRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation error",
          errors: validationResult.error.format()
        });
      }
      
      const { recipientEmail, customMessage } = validationResult.data;
      
      // Get case data (verify user has access)
      const caseData = await storage.getCase(req.params.id, userId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Create a secure share link for the client (7 days expiration, view-only)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      const shareLink = await storage.createShareLink({
        caseId: req.params.id,
        createdBy: userId,
        recipientEmail,
        recipientName: caseData.clientName,
        isExternal: true,
        accessLevel: "view",
        expiresAt,
        clientConsent: true, // Email implies consent
        smsProtection: false, // Can be enhanced later
      });
      
      // Get firm profile for email branding
      const firmProfile = await storage.getFirmProfile();
      
      // Send email with share link
      const result = await sendCaseEmail({
        to: recipientEmail,
        caseTitle: caseData.title,
        clientName: caseData.clientName,
        matterReference: caseData.matterReference || undefined,
        shareLinkId: shareLink.id,
        customMessage: customMessage || undefined,
        firmProfile: firmProfile ? {
          firmName: firmProfile.firmName,
          phone: firmProfile.phone || undefined,
          email: firmProfile.email || undefined,
          addressLine1: firmProfile.addressLine1 || undefined,
          addressLine2: firmProfile.addressLine2 || undefined,
          city: firmProfile.city || undefined,
          postcode: firmProfile.postcode || undefined,
        } : undefined,
      });
      
      if (!result.success) {
        return res.status(500).json({ 
          message: "Failed to send email",
          error: result.error 
        });
      }
      
      // Log audit events
      await logAuditEvent(userId, "case_email_sent", {
        caseId: req.params.id,
        metadata: { 
          recipientEmail, 
          messageId: result.messageId,
          hasCustomMessage: !!customMessage,
          shareLinkId: shareLink.id,
        },
        req,
      });
      
      await logAuditEvent(userId, "share_link_created", {
        caseId: req.params.id,
        metadata: { 
          shareLinkId: shareLink.id,
          recipientEmail,
          expiresAt: shareLink.expiresAt,
        },
        req,
      });
      
      res.json({ 
        success: true, 
        message: "Email sent successfully",
        messageId: result.messageId,
        shareLinkId: shareLink.id,
      });
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/cases/:id/share-link", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body with Zod
      const shareLinkRequestSchema = z.object({
        recipientEmail: z.string().email("Invalid email address"),
        recipientName: z.string().min(1, "Recipient name is required"),
        isExternal: z.boolean(),
        organization: z.string().optional(),
        expiration: z.enum(["24hours", "7days", "30days", "custom"]),
        accessLevel: z.enum(["view", "download"]),
        password: z.string().optional(),
        clientConsent: z.boolean(),
        smsProtection: z.boolean().default(false),
        smsPhoneNumber: z.string().optional(),
        customMessage: z.string().optional(),
        sharedDocuments: z.array(z.enum(["attendance_note", "summary", "transcript"])).min(1, "Must select at least one document to share").default(["attendance_note"]),
      });
      
      const validationResult = shareLinkRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation error",
          errors: validationResult.error.format()
        });
      }
      
      const { recipientEmail, recipientName, isExternal, organization, expiration, accessLevel, password, clientConsent, smsProtection, smsPhoneNumber, customMessage, sharedDocuments } = validationResult.data;
      
      // Validate SMS phone number if SMS protection is enabled
      let formattedPhoneNumber: string | undefined;
      if (smsProtection) {
        if (!smsPhoneNumber) {
          return res.status(400).json({ 
            message: "Phone number is required when SMS protection is enabled" 
          });
        }
        formattedPhoneNumber = formatUKPhoneNumber(smsPhoneNumber);
      }
      
      // Get case data (verify user has access)
      const caseData = await storage.getCase(req.params.id, userId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // For external sharing, verify server-side consent from database
      if (isExternal) {
        // Check if client consent exists in the database
        const consentLogs = await storage.getConsentLogsByCase(req.params.id, userId);
        const hasValidConsent = consentLogs.some((log: any) => log.consentGiven === true);
        
        if (!hasValidConsent) {
          await logAuditEvent(userId, "case_updated", {
            caseId: req.params.id,
            metadata: { 
              action: "external_share_blocked_no_consent",
              recipientEmail,
            },
            severity: "warning",
            req,
          });
          return res.status(403).json({ 
            message: "Cannot share externally: No client consent on record for this case" 
          });
        }
        
        // Also require frontend confirmation of consent
        if (!clientConsent) {
          return res.status(400).json({ 
            message: "Client consent confirmation is required for external sharing" 
          });
        }
      }
      
      // Calculate expiration date based on selected duration
      const expiresAt = new Date();
      switch (expiration) {
        case "24hours":
          expiresAt.setHours(expiresAt.getHours() + 24);
          break;
        case "7days":
          expiresAt.setDate(expiresAt.getDate() + 7);
          break;
        case "30days":
          expiresAt.setDate(expiresAt.getDate() + 30);
          break;
        default:
          expiresAt.setDate(expiresAt.getDate() + 7); // Default to 7 days
      }
      
      // Hash password if provided
      let hashedPassword: string | undefined;
      if (password) {
        const saltRounds = 10;
        hashedPassword = await bcrypt.hash(password, saltRounds);
      }
      
      // Create share link in database
      const shareLink = await storage.createShareLink({
        caseId: req.params.id,
        createdBy: userId,
        recipientEmail,
        recipientName,
        isExternal,
        organization: organization || undefined,
        accessLevel,
        expiresAt,
        password: hashedPassword,
        clientConsent,
        smsProtection: smsProtection || false,
        smsPhoneNumber: formattedPhoneNumber,
        sharedDocuments,
      });
      
      // Auto-mark case as completed (actioned) when shared with client
      await storage.updateCase(req.params.id, { status: "completed" }, userId);
      
      // Get firm profile for email branding
      const firmProfile = await storage.getFirmProfile();
      
      // Send email with share link
      const systemMessage = `You have been granted ${accessLevel} access to this case. This link will expire in ${expiration.replace(/(\d+)(\w+)/, '$1 $2')}.${password ? ' A password is required to access the documents.' : ''}${smsProtection ? ' SMS verification is required to access the documents.' : ''}`;
      const fullMessage = customMessage ? `${customMessage}\n\n${systemMessage}` : systemMessage;
      
      const result = await sendCaseEmail({
        to: recipientEmail,
        caseTitle: caseData.title,
        clientName: recipientName,
        matterReference: caseData.matterReference || undefined,
        shareLinkId: shareLink.id,
        customMessage: fullMessage,
        firmProfile: firmProfile ? {
          firmName: firmProfile.firmName,
          phone: firmProfile.phone || undefined,
          email: firmProfile.email || undefined,
          addressLine1: firmProfile.addressLine1 || undefined,
          addressLine2: firmProfile.addressLine2 || undefined,
          city: firmProfile.city || undefined,
          postcode: firmProfile.postcode || undefined,
        } : undefined,
      });
      
      if (!result.success) {
        return res.status(500).json({ 
          message: "Failed to send secure link",
          error: result.error 
        });
      }
      
      // Log audit events
      await logAuditEvent(userId, "case_link_shared", {
        caseId: req.params.id,
        metadata: { 
          recipientEmail,
          recipientName,
          isExternal,
          organization,
          expiration,
          accessLevel,
          passwordProtected: !!password,
          smsProtected: smsProtection,
          clientConsent,
          messageId: result.messageId,
          shareLinkId: shareLink.id,
        },
        req,
      });
      
      await logAuditEvent(userId, "share_link_created", {
        caseId: req.params.id,
        metadata: { 
          shareLinkId: shareLink.id,
          recipientEmail,
          expiresAt: shareLink.expiresAt,
        },
        req,
      });
      
      // Track document versions shared with client
      const allCaseDocuments = await storage.getActiveDocumentsByCase(req.params.id, userId);
      for (const doc of allCaseDocuments) {
        if (sharedDocuments.includes(doc.type)) {
          await storage.createClientVersionTracking({
            documentId: doc.id,
            sentToClient: true,
            sentAt: new Date(),
            sentBy: userId,
            sentMethod: smsProtection ? 'sms_2fa' : 'share_link',
            amendmentReason: null,
            versionChangeWarned: false,
          });
        }
      }
      
      res.json({ 
        success: true, 
        message: "Secure link sent successfully",
        messageId: result.messageId,
        shareLinkId: shareLink.id,
      });
    } catch (error: any) {
      next(error);
    }
  });

  // Protected Audio routes
  app.post("/api/audio/upload-url", isAuthenticated, presignedUrlLimiter, async (req, res, next) => {
    try {
      const objectStorageService = new ObjectStorageService();
      // Security: Enforce 100MB size limit on presigned URL
      const uploadURL = await objectStorageService.getObjectEntityUploadURL(MAX_AUDIO_SIZE_BYTES);
      res.json({ uploadURL });
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/audio", isAuthenticated, audioUploadLimiter, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertAudioRecordingSchema.parse(req.body);
      
      const caseData = await storage.getCase(validatedData.caseId, userId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // GDPR Compliance: 7-day retention OR until successful processing (whichever comes first)
      // UK GDPR allows retention "as long as necessary" for processing purpose
      // 7 days ensures reliable AI processing even with API failures/retries
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      const audioRecording = await storage.createAudioRecording({
        caseId: validatedData.caseId,
        expiresAt,
        filePath: undefined,
        duration: undefined,
      });
      res.json(audioRecording);
    } catch (error: any) {
      // Zod validation errors: return 400 with message
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.message });
      }
      // All other errors: use sanitized error handler
      next(error);
    }
  });

  // Configure multer for multipart file uploads (memory storage)
  const multer = await import('multer');
  const upload = multer.default({
    storage: multer.default.memoryStorage(),
    limits: {
      fileSize: MAX_AUDIO_SIZE_BYTES, // 100MB max
    },
    fileFilter: (req, file, cb) => {
      // Accept audio files only
      const allowedMimeTypes = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav', 'audio/mpeg'];
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only audio files are allowed.'));
      }
    },
  });

  // Multer error handling middleware
  const handleMulterError = (err: any, req: any, res: Response, next: NextFunction) => {
    if (err instanceof multer.default.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File too large (max 100MB)' });
      }
      return res.status(400).json({ message: err.message });
    }
    
    // Handle fileFilter rejections
    if (err.message && err.message.includes('Invalid file type')) {
      return res.status(400).json({ message: err.message });
    }
    
    next(err);
  };

  // Multipart upload endpoint using industry-standard approach
  app.post("/api/audio/:id/upload", 
    isAuthenticated, 
    audioUploadLimiter,
    upload.single('audioFile'),
    handleMulterError,
    async (req: any, res: Response, next: NextFunction) => {
      try {
        const userId = req.user.claims.sub;
        const audioId = req.params.id;
        
        // Validate multipart upload
        if (!req.file) {
          return res.status(400).json({ message: "Audio file is required" });
        }

        if (!req.body.duration) {
          return res.status(400).json({ message: "Duration is required" });
        }

        // Get audio record and verify ownership
        const audioRecording = await storage.getAudioRecording(audioId);
        if (!audioRecording) {
          return res.status(404).json({ message: "Audio recording not found" });
        }

        const caseData = await storage.getCase(audioRecording.caseId, userId);
        if (!caseData) {
          return res.status(403).json({ message: "Not authorized" });
        }

        // File is already in memory as Buffer (req.file.buffer)
        const audioBuffer = req.file.buffer;
        
        console.log(`Received audio file: ${req.file.originalname}, size: ${audioBuffer.length} bytes, type: ${req.file.mimetype}`);

        // Upload to Backblaze B2 using S3 SDK
        const objectStorageService = new ObjectStorageService();
        
        // Generate unique object ID with proper path mapping
        const { id, key, dbPath } = objectStorageService.createPrivateObjectId();
        
        console.log(`Uploading audio to Backblaze B2: ${key} (DB path: ${dbPath})`);
        
        // Upload to S3-compatible storage (Backblaze B2)
        await objectStorageService.uploadFile(key, audioBuffer, req.file.mimetype);
        
        console.log(`Audio uploaded successfully to ${key}`);
        
        // Store the object path for database (standardized format: /objects/{uuid})
        const objectPath = dbPath;

        // Update audio record with file path, duration, and MIME type
        const updated = await storage.updateAudioRecording(audioId, {
          filePath: objectPath,
          mimeType: req.file.mimetype,
          duration: parseFloat(req.body.duration),
        });

        auditLogger.logFromRequest(AuditEventType.AUDIO_UPLOADED, req, {
          resourceId: audioId,
          resourceType: "audio",
          action: "upload",
          severity: "medium",
        });

        res.json(updated);
      } catch (error: any) {
        console.error('Audio upload error:', error);
        next(error);
      }
    }
  );

  // NOTE: Legacy PUT /api/audio/:id route removed - replaced by POST /api/audio/:id/upload multipart

  // ============================================
  // CHUNKED UPLOAD ROUTES (10-second incremental uploads)
  // ============================================

  // Create a new chunked upload session
  app.post("/api/audio/chunk-session", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { mimeType, caseId } = req.body;

      if (!mimeType) {
        return res.status(400).json({ message: "mimeType is required" });
      }

      const sessionId = await chunkedUploadService.createSession(userId, mimeType, caseId);
      
      res.json({ 
        sessionId,
        message: "Chunked upload session created",
      });
    } catch (error: any) {
      next(error);
    }
  });

  // Get incomplete recording sessions for recovery
  app.get("/api/audio/incomplete-sessions", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const sessions = await chunkedUploadService.getIncompleteSessions(userId);
      
      // Enrich with case info if available
      const enrichedSessions = await Promise.all(
        sessions.map(async (session) => {
          let caseName = null;
          let clientName = null;
          if (session.caseId) {
            const caseData = await storage.getCase(session.caseId, userId);
            if (caseData) {
              caseName = caseData.title;
              clientName = caseData.clientName;
            }
          }
          return {
            ...session,
            caseName,
            clientName,
          };
        })
      );
      
      res.json(enrichedSessions);
    } catch (error: any) {
      next(error);
    }
  });

  // Upload a chunk to an existing session
  app.post("/api/audio/chunk-session/:sessionId/chunk",
    isAuthenticated,
    audioUploadLimiter,
    upload.single('chunk'),
    handleMulterError,
    async (req: any, res, next) => {
      try {
        const userId = req.user.claims.sub;
        const { sessionId } = req.params;
        const chunkNumber = parseInt(req.body.chunkNumber, 10);

        if (!req.file) {
          return res.status(400).json({ message: "Chunk data is required" });
        }

        if (isNaN(chunkNumber) || chunkNumber < 0) {
          return res.status(400).json({ message: "Valid chunkNumber is required" });
        }

        const result = await chunkedUploadService.uploadChunk(
          sessionId,
          userId,
          chunkNumber,
          req.file.buffer
        );

        res.json({
          success: true,
          chunkNumber,
          chunksReceived: result.received,
          bytesStored: result.bytesStored,
        });
      } catch (error: any) {
        if (error.message.includes("not found") || error.message.includes("Unauthorized")) {
          return res.status(404).json({ message: error.message });
        }
        next(error);
      }
    }
  );

  // Finalize a chunked upload session and assemble the audio file
  app.post("/api/audio/chunk-session/:sessionId/finalize", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.params;
      const { audioRecordingId, duration } = req.body;

      if (!audioRecordingId) {
        return res.status(400).json({ message: "audioRecordingId is required" });
      }

      // Verify the audio recording exists and user owns it
      const audioRecording = await storage.getAudioRecording(audioRecordingId);
      if (!audioRecording) {
        return res.status(404).json({ message: "Audio recording not found" });
      }

      const caseData = await storage.getCase(audioRecording.caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }

      // Finalize the session (combines chunks and uploads to storage)
      const result = await chunkedUploadService.finalizeSession(
        sessionId,
        userId,
        audioRecordingId
      );

      // Update the audio recording with the file path and consent duration
      const updated = await storage.updateAudioRecording(audioRecordingId, {
        filePath: result.filePath,
        duration: duration ? parseFloat(duration) : undefined,
        consentSegmentPath: result.consentSegmentPath,
        consentDurationSeconds: result.consentDurationSeconds,
      });

      auditLogger.logFromRequest(AuditEventType.AUDIO_UPLOADED, req, {
        resourceId: audioRecordingId,
        resourceType: "audio",
        action: "chunked_upload_finalized",
        severity: "medium",
        metadata: {
          totalChunks: result.totalChunks,
          totalBytes: result.totalBytes,
          consentSegmentPreserved: !!result.consentSegmentPath,
        },
      });

      // Send recording confirmation email asynchronously (only if user preference enabled)
      (async () => {
        try {
          const user = await storage.getUser(userId);
          const userPreferences = await storage.getUserPreferences(userId);
          
          // Check if user has enabled recording confirmation emails (default: off)
          if (!userPreferences?.sendRecordingConfirmationEmails) {
            console.log(`[EMAIL] Recording confirmation skipped - user preference disabled for case ${caseData.id}`);
            return;
          }
          
          if (user?.email) {
            const firmProfile = await storage.getFirmProfile(userId);
            const durationSeconds = duration ? parseFloat(duration) : 0;
            const minutes = Math.floor(durationSeconds / 60);
            const seconds = Math.floor(durationSeconds % 60);
            const recordingDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            await sendRecordingConfirmationEmail({
              to: user.email,
              solicitorName: user.firstName || user.email.split('@')[0],
              caseTitle: caseData.title,
              clientName: caseData.clientName,
              matterReference: caseData.matterReference || undefined,
              recordingDuration,
              recordedAt: new Date(),
              caseId: caseData.id,
              documentsGenerated: ['Attendance Note', 'Case Summary', 'Full Transcript'],
              firmProfile: firmProfile ? {
                firmName: firmProfile.firmName,
                phone: firmProfile.phone || undefined,
                email: firmProfile.email || undefined,
              } : undefined,
            });

            console.log(`[EMAIL] Recording confirmation sent for case ${caseData.id}`);
          }
        } catch (emailError) {
          console.error('[EMAIL] Failed to send recording confirmation:', emailError);
        }
      })();

      res.json({
        success: true,
        audioRecording: updated,
        totalChunks: result.totalChunks,
        totalBytes: result.totalBytes,
        consentSegmentPreserved: !!result.consentSegmentPath,
      });
    } catch (error: any) {
      if (error.message.includes("not found") || error.message.includes("Unauthorized")) {
        return res.status(404).json({ message: error.message });
      }
      next(error);
    }
  });

  // Get status of a chunked upload session
  app.get("/api/audio/chunk-session/:sessionId/status", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.params;

      const status = chunkedUploadService.getSessionStatus(sessionId, userId);
      res.json(status);
    } catch (error: any) {
      next(error);
    }
  });

  // Cancel a chunked upload session
  app.delete("/api/audio/chunk-session/:sessionId", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.params;

      const cancelled = await chunkedUploadService.cancelSession(sessionId, userId);
      
      if (!cancelled) {
        return res.status(404).json({ message: "Session not found or already finalized" });
      }

      res.json({ success: true, message: "Session cancelled" });
    } catch (error: any) {
      next(error);
    }
  });

  // Get recovery status for a chunked upload session (for resuming after connection issues)
  app.get("/api/audio/chunk-session/:sessionId/recover", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.params;

      const status = chunkedUploadService.getSessionStatus(sessionId, userId);
      
      if (!status) {
        return res.status(404).json({ 
          canRecover: false,
          message: "Session not found, expired, or already finalized" 
        });
      }

      res.json({
        canRecover: true,
        ...status,
      });
    } catch (error: any) {
      next(error);
    }
  });

  // Upload a recovery chunk directly to durable storage (for sessions expired from memory after server restart)
  app.post("/api/audio/recovery-chunk/:sessionId",
    isAuthenticated,
    audioUploadLimiter,
    upload.single('chunk'),
    handleMulterError,
    async (req: any, res, next) => {
      try {
        const userId = req.user.claims.sub;
        const { sessionId } = req.params;
        const chunkNumber = parseInt(req.body.chunkNumber, 10);

        if (!req.file) {
          return res.status(400).json({ message: "Chunk data is required" });
        }

        if (isNaN(chunkNumber) || chunkNumber < 0) {
          return res.status(400).json({ message: "Valid chunkNumber is required" });
        }

        const result = await chunkedUploadService.uploadRecoveryChunk(
          sessionId,
          userId,
          chunkNumber,
          req.file.buffer
        );

        res.json({
          success: true,
          chunkNumber,
          bytesStored: result.bytesStored,
        });
      } catch (error: any) {
        console.error('Recovery chunk upload error:', error);
        next(error);
      }
    }
  );

  // Recover an interrupted recording session - creates a case from saved chunks
  app.post("/api/audio/recover-session/:sessionId", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.params;

      const result = await chunkedUploadService.recoverSession(sessionId, userId);
      
      if (!result.success) {
        return res.status(400).json(result);
      }

      await logAuditEvent(userId, "recording_recovered", {
        caseId: result.caseId,
        metadata: {
          sessionId,
          audioRecordingId: result.audioRecordingId,
          durationSeconds: result.durationSeconds,
          hasConsent: result.hasConsent,
        },
        severity: "medium",
        req,
      });

      res.json(result);
    } catch (error: any) {
      console.error('Recovery error:', error);
      next(error);
    }
  });

  // Discard an interrupted recording session
  app.delete("/api/audio/recover-session/:sessionId", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.params;

      const discarded = await chunkedUploadService.discardSession(sessionId, userId);
      
      if (!discarded) {
        return res.status(404).json({ message: "Session not found" });
      }

      res.json({ success: true, message: "Session discarded" });
    } catch (error: any) {
      next(error);
    }
  });

  // Mark consent confirmation timestamp for a recording session
  app.post("/api/audio/chunk-session/:sessionId/consent", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.params;

      const result = await chunkedUploadService.markConsentConfirmed(sessionId, userId);
      
      await logAuditEvent(userId, "consent_timestamp_marked", {
        metadata: {
          sessionId,
          consentChunk: result.consentChunk,
          elapsedSeconds: result.elapsedSeconds,
        },
        severity: "info",
        req,
      });

      res.json(result);
    } catch (error: any) {
      if (error.message.includes("not found") || error.message.includes("Unauthorized")) {
        return res.status(404).json({ message: error.message });
      }
      next(error);
    }
  });

  // ============================================
  // END CHUNKED UPLOAD ROUTES
  // ============================================

  app.get("/api/audio/by-case/:caseId", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      
      const caseData = await storage.getCase(req.params.caseId, userId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      const audioRecording = await storage.getAudioRecordingByCase(req.params.caseId, userId);
      if (!audioRecording) {
        return res.status(404).json({ message: "Audio recording not found" });
      }
      
      if (new Date() > audioRecording.expiresAt && !audioRecording.deletedAt) {
        // GDPR Compliance: Delete expired audio and log audit event
        if (audioRecording.filePath) {
          try {
            const objectStorageService = new ObjectStorageService();
            await objectStorageService.deleteObjectEntity(audioRecording.filePath);
            await storage.updateAudioRecording(audioRecording.id, { deletedAt: new Date() });
            
            await logAuditEvent(userId, "audio_deleted", {
              caseId: audioRecording.caseId,
              audioRecordingId: audioRecording.id,
              metadata: {
                reason: "24hr_retention_policy_expiration",
                filePath: audioRecording.filePath,
                expiresAt: audioRecording.expiresAt.toISOString(),
                deletedAt: new Date().toISOString(),
              },
              severity: "warning",
              req,
            });
          } catch (deleteError) {
            console.error("Failed to delete expired audio:", deleteError);
          }
        }
        
        return res.status(410).json({ message: "Audio recording has expired (24hr retention policy)" });
      }
      
      res.json(audioRecording);
    } catch (error: any) {
      next(error);
    }
  });

  // Get presigned URL for consent segment audio (preserved indefinitely for compliance)
  app.get("/api/audio/:audioId/consent-segment", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { audioId } = req.params;

      const audioRecording = await storage.getAudioRecording(audioId, userId);
      if (!audioRecording) {
        return res.status(404).json({ message: "Audio recording not found" });
      }

      if (!audioRecording.consentSegmentPath) {
        return res.status(404).json({ message: "No consent segment available for this recording" });
      }

      const objectStorageService = new ObjectStorageService();
      const presignedUrl = await objectStorageService.getPresignedUrl(audioRecording.consentSegmentPath);
      
      await logAuditEvent(userId, "consent_segment_accessed", {
        audioRecordingId: audioId,
        caseId: audioRecording.caseId,
        metadata: {
          consentSegmentPath: audioRecording.consentSegmentPath,
        },
        severity: "info",
        req,
      });

      res.json({ 
        url: presignedUrl,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });
    } catch (error: any) {
      next(error);
    }
  });

  // Consent logging routes
  app.post("/api/consent", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertConsentLogSchema.parse({
        ...req.body,
        solicitorId: userId, // Ensure solicitorId matches authenticated user
      });
      
      // Verify user owns the case and create consent log
      const consentLog = await storage.createConsentLog(validatedData, userId);
      
      auditLogger.logFromRequest(
        validatedData.consentGiven ? AuditEventType.CONSENT_GIVEN : AuditEventType.CONSENT_DECLINED,
        req,
        {
          resourceId: consentLog.id,
          resourceType: "consent",
          severity: "medium",
        }
      );
      
      res.json(consentLog);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  });

  app.get("/api/consent/by-case/:caseId", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.caseId;
      
      const consentLogs = await storage.getConsentLogsByCase(caseId, userId);
      res.json(consentLogs);
    } catch (error: any) {
      next(error);
    }
  });

  // AI Processing routes
  
  // Transcribe audio for quick notes (no case association)
  app.post("/api/transcribe", isAuthenticated, upload.single('audio'), async (req: any, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No audio file provided" });
      }

      // Validate file type
      const allowedMimeTypes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a'];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ message: "Invalid audio format" });
      }

      // Transcribe using OpenAI Whisper
      console.log('Starting quick note transcription');
      const result = await openaiService.transcribeAudio(req.file.buffer);
      
      console.log('Quick note transcription completed');
      res.json({ text: result.text });
    } catch (error: any) {
      console.error('Quick note transcription error:', error);
      next(error);
    }
  });
  
  app.post("/api/cases/:id/transcribe", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Verify ownership
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      // Get audio recording
      const audioRecording = await storage.getAudioRecordingByCase(caseId, userId);
      if (!audioRecording || !audioRecording.filePath) {
        return res.status(404).json({ message: "No audio recording found for this case" });
      }
      
      // Check if transcript already exists
      const existingTranscript = await storage.getTranscriptByCase(caseId, userId);
      if (existingTranscript) {
        return res.json({ transcript: existingTranscript, message: "Transcript already exists" });
      }
      
      // Download audio file from storage
      const objectStorageService = new ObjectStorageService();
      const audioBuffer = await objectStorageService.getObjectEntityFile(audioRecording.filePath);
      
      // Transcribe using OpenAI Whisper
      console.log(`Starting transcription for case ${caseId}`);
      const result = await openaiService.transcribeAudio(audioBuffer);
      
      // Save transcript
      const transcript = await storage.createTranscript({
        caseId,
        content: result.text,
      });
      
      // Update case status
      await storage.updateCase(caseId, { status: "processing" }, userId);
      
      auditLogger.logFromRequest(AuditEventType.TRANSCRIPT_GENERATED, req, {
        resourceId: transcript.id,
        resourceType: "transcript",
        action: "generate",
        severity: "low",
      });
      
      res.json({ transcript, message: "Transcription completed" });
    } catch (error: any) {
      console.error('Transcription error:', error);
      next(error);
    }
  });

  app.post("/api/cases/:id/generate-documents", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Verify ownership
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      // Get transcript
      const transcript = await storage.getTranscriptByCase(caseId, userId);
      if (!transcript) {
        return res.status(404).json({ message: "No transcript found. Please transcribe the audio first." });
      }
      
      // Check if documents already exist
      const existingDocs = await storage.getActiveDocumentsByCase(caseId, userId);
      if (existingDocs.length > 0) {
        return res.json({ documents: existingDocs, message: "Documents already exist" });
      }
      
      // Generate documents using GPT-4
      console.log(`Generating documents for case ${caseId}`);
      const result = await openaiService.generateDocuments(transcript.content, {
        title: caseData.title,
        clientName: caseData.clientName,
        matterReference: caseData.matterReference || undefined,
      });
      
      // Save attendance note
      const attendanceNote = await storage.createDocument({
        caseId,
        transcriptSnapshotId: transcript.id,
        type: "attendance_note",
        content: result.attendanceNote,
        version: 1,
        versionType: "ai_generated",
        createdBy: userId,
        isActive: true,
      });
      
      // Update case status
      await storage.updateCase(caseId, { status: "completed" }, userId);
      
      auditLogger.logFromRequest(AuditEventType.DOCUMENT_GENERATED, req, {
        resourceId: attendanceNote.id,
        resourceType: "document",
        action: "generate",
        severity: "low",
      });
      
      res.json({ 
        attendanceNote, 
        message: "Documents generated successfully" 
      });
    } catch (error: any) {
      console.error('Document generation error:', error);
      next(error);
    }
  });

  // All-in-one processing: transcribe + generate documents using background jobs
  app.post("/api/cases/:id/process", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Verify ownership
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      // GDPR Compliance: Verify valid consent exists before processing
      const consentLogs = await storage.getConsentLogsByCase(caseId, userId);
      const hasValidConsent = consentLogs.some(log => log.consentGiven === true);
      
      if (!hasValidConsent) {
        auditLogger.logFromRequest(AuditEventType.ACCESS_CONTROL_VIOLATION, req, {
          resourceId: caseId,
          resourceType: "case",
          action: "process_without_consent",
          severity: "high",
        });
        return res.status(403).json({ 
          message: "GDPR compliance error: Valid client consent must be recorded before processing audio recordings" 
        });
      }
      
      // Check if audio recording exists and has file path
      const audioRecording = await storage.getAudioRecordingByCase(caseId, userId);
      if (!audioRecording || !audioRecording.filePath) {
        return res.status(404).json({ message: "No audio recording found for this case" });
      }
      
      // Prevent duplicate processing - check both case status and metadata
      const metadata = (caseData.aiProcessingMetadata as any) || {};
      if (caseData.status === 'processing' || metadata.status === 'processing') {
        return res.status(400).json({ message: "Case is already being processed" });
      }
      
      // Initialize processing metadata and update status
      await storage.updateCase(caseId, { 
        status: "processing",
        aiProcessingMetadata: {
          status: 'processing',
          progress: 0,
          currentStep: 'Queued for processing...',
        }
      }, userId);
      
      // Queue AI processing job
      const { jobQueue } = await import('./services/jobQueue');
      const jobId = await jobQueue.addJob('ai-processing', { caseId, userId });
      
      auditLogger.logFromRequest(AuditEventType.AI_PROCESSING_STARTED, req, {
        resourceId: caseId,
        resourceType: "case",
        action: "queue_processing",
        severity: "medium",
        additionalInfo: { jobId },
      });
      
      res.json({ 
        message: "AI processing started", 
        jobId,
        status: 'processing'
      });
    } catch (error: any) {
      console.error('Case processing error:', error);
      // Update case status and metadata to indicate failure
      try {
        const userId = (req as any).user?.claims?.sub;
        if (userId) {
          await storage.updateCase(req.params.id, { 
            status: "pending",
            aiProcessingMetadata: {
              status: 'failed',
              error: error.message,
            }
          }, userId);
        }
      } catch (e) {}
      next(error);
    }
  });

  // Retry failed AI processing
  app.post("/api/cases/:id/retry-processing", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Verify ownership
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      // Check if case actually failed
      const metadata = (caseData.aiProcessingMetadata as any) || {};
      if (caseData.status !== 'failed' && metadata.status !== 'failed') {
        return res.status(400).json({ message: "Only failed cases can be retried" });
      }
      
      // GDPR Compliance: Verify valid consent exists
      const consentLogs = await storage.getConsentLogsByCase(caseId, userId);
      const hasValidConsent = consentLogs.some(log => log.consentGiven === true);
      
      if (!hasValidConsent) {
        return res.status(403).json({ 
          message: "GDPR compliance error: Valid client consent required" 
        });
      }
      
      // Check if audio recording exists
      const audioRecording = await storage.getAudioRecordingByCase(caseId, userId);
      if (!audioRecording || !audioRecording.filePath) {
        return res.status(404).json({ message: "No audio recording found" });
      }
      
      // Reset processing metadata and update status
      await storage.updateCase(caseId, { 
        status: "processing",
        aiProcessingMetadata: {
          status: 'processing',
          progress: 0,
          currentStep: 'Retrying processing...',
          error: undefined, // Clear previous error
        }
      }, userId);
      
      // Queue AI processing job
      const { jobQueue } = await import('./services/jobQueue');
      const jobId = await jobQueue.addJob('ai-processing', { caseId, userId });
      
      auditLogger.logFromRequest(AuditEventType.AI_PROCESSING_STARTED, req, {
        resourceId: caseId,
        resourceType: "case",
        action: "retry_processing",
        severity: "medium",
        additionalInfo: { jobId, retry: true },
      });
      
      res.json({ 
        message: "AI processing retry started", 
        jobId,
        status: 'processing'
      });
    } catch (error: any) {
      console.error('Retry processing error:', error);
      next(error);
    }
  });

  // Get transcript for a case
  app.get("/api/cases/:id/transcript", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Verify ownership
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const transcript = await storage.getTranscriptByCase(caseId, userId);
      if (!transcript) {
        return res.status(404).json({ message: "No transcript found" });
      }
      
      res.json(transcript);
    } catch (error: any) {
      next(error);
    }
  });

  // Add redaction to transcript
  app.post("/api/cases/:id/transcript/redact", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      const { start, end, reason, textStart, textEnd, selectedText } = req.body;
      
      if (typeof start !== 'number' || typeof end !== 'number' || !reason?.trim()) {
        return res.status(400).json({ message: "Invalid redaction data" });
      }
      
      // Verify ownership
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const transcript = await storage.getTranscriptByCase(caseId, userId);
      if (!transcript) {
        return res.status(404).json({ message: "No transcript found" });
      }
      
      // Get current redactions or initialize empty array
      const currentRedactions = (transcript.redactions || []) as any[];
      
      // Check if this exact redaction already exists
      const isPartialRedaction = typeof textStart === 'number' && typeof textEnd === 'number';
      const alreadyRedacted = currentRedactions.some((r: any) => {
        if (isPartialRedaction) {
          // For partial redactions, check all fields match
          return r.start === start && r.end === end && r.textStart === textStart && r.textEnd === textEnd;
        } else {
          // For full redactions, check only start/end and that it's not a partial redaction
          return r.start === start && r.end === end && r.textStart === undefined && r.textEnd === undefined;
        }
      });
      
      if (alreadyRedacted) {
        return res.status(400).json({ message: "This text is already redacted" });
      }
      
      // Add new redaction with optional partial redaction fields
      const newRedaction: any = {
        start,
        end,
        reason: reason.trim(),
        redactedBy: userId,
        timestamp: new Date().toISOString(),
      };
      
      // Add partial redaction fields if present
      if (isPartialRedaction) {
        newRedaction.textStart = textStart;
        newRedaction.textEnd = textEnd;
        if (selectedText) {
          newRedaction.selectedText = selectedText;
        }
      }
      
      const updatedRedactions = [...currentRedactions, newRedaction];
      
      const updatedTranscript = await storage.updateTranscript(
        transcript.id,
        { redactions: updatedRedactions },
        userId
      );
      
      // Log audit event
      await logAuditEvent(userId, "transcript_redacted", {
        caseId,
        transcriptId: transcript.id,
        metadata: {
          action: 'add',
          start,
          end,
          reason: reason.trim(),
          isPartial: isPartialRedaction,
          textStart: isPartialRedaction ? textStart : undefined,
          textEnd: isPartialRedaction ? textEnd : undefined,
        },
        req,
      });
      
      res.json(updatedTranscript);
    } catch (error: any) {
      next(error);
    }
  });

  // Remove redaction from transcript
  app.delete("/api/cases/:id/transcript/redact", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      const { start, end, textStart, textEnd } = req.body;
      
      if (typeof start !== 'number' || typeof end !== 'number') {
        return res.status(400).json({ message: "Invalid redaction data" });
      }
      
      // Verify ownership
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const transcript = await storage.getTranscriptByCase(caseId, userId);
      if (!transcript) {
        return res.status(404).json({ message: "No transcript found" });
      }
      
      // Get current redactions
      const currentRedactions = (transcript.redactions || []) as any[];
      
      // Find and remove the redaction (supporting both full and partial redactions)
      const isPartialRemoval = typeof textStart === 'number' && typeof textEnd === 'number';
      const updatedRedactions = currentRedactions.filter((r: any) => {
        if (isPartialRemoval) {
          // For partial redactions, match all fields
          return !(r.start === start && r.end === end && r.textStart === textStart && r.textEnd === textEnd);
        } else {
          // For full redactions, match start/end and ensure it's not a partial redaction
          return !(r.start === start && r.end === end && r.textStart === undefined && r.textEnd === undefined);
        }
      });
      
      if (updatedRedactions.length === currentRedactions.length) {
        return res.status(404).json({ message: "Redaction not found" });
      }
      
      const updatedTranscript = await storage.updateTranscript(
        transcript.id,
        { redactions: updatedRedactions },
        userId
      );
      
      // Log audit event
      await logAuditEvent(userId, "transcript_redacted", {
        caseId,
        transcriptId: transcript.id,
        metadata: {
          action: 'remove',
          start,
          end,
          isPartial: isPartialRemoval,
          textStart: isPartialRemoval ? textStart : undefined,
          textEnd: isPartialRemoval ? textEnd : undefined,
        },
        req,
      });
      
      res.json(updatedTranscript);
    } catch (error: any) {
      next(error);
    }
  });

  // Get documents for a case
  app.get("/api/cases/:id/documents", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Verify ownership
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const documents = await storage.getActiveDocumentsByCase(caseId, userId);
      res.json(documents);
    } catch (error: any) {
      next(error);
    }
  });

  // Get client version tracking history for a case
  app.get("/api/cases/:id/shared-history", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Verify ownership
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const history = await storage.getClientVersionTrackingByCase(caseId, userId);
      res.json(history);
    } catch (error: any) {
      next(error);
    }
  });

  // Record document shared with client
  app.post("/api/documents/:documentId/track-share", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { documentId } = req.params;
      const { sentMethod, amendmentReason } = req.body;
      
      // Verify document exists and user owns it
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      const caseData = await storage.getCase(document.caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      // Check if a previous version was shared
      const latestShared = await storage.getLatestClientVersion(documentId);
      const versionChangeWarned = latestShared ? latestShared.documentId !== documentId : false;
      
      const tracking = await storage.createClientVersionTracking({
        documentId,
        sentToClient: true,
        sentAt: new Date(),
        sentBy: userId,
        sentMethod: sentMethod || 'share_link',
        amendmentReason: amendmentReason || null,
        versionChangeWarned,
      });
      
      // Log audit event
      await logAuditEvent(userId, "document_shared_with_client", {
        caseId: document.caseId,
        documentId,
        metadata: {
          documentType: document.type,
          documentVersion: document.version,
          sentMethod,
          versionChangeWarned,
        },
        req,
      });
      
      res.json(tracking);
    } catch (error: any) {
      next(error);
    }
  });

  // Get latest version sent to client for a document
  app.get("/api/documents/:documentId/latest-client-version", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { documentId } = req.params;
      
      // Verify document exists and user owns it
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      const caseData = await storage.getCase(document.caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const latestVersion = await storage.getLatestClientVersion(documentId);
      res.json(latestVersion || null);
    } catch (error: any) {
      next(error);
    }
  });

  // ============================================
  // Action Items Routes
  // ============================================

  // Get action items for a case
  app.get("/api/cases/:id/action-items", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const items = await storage.getActionItemsByCase(caseId, userId);
      res.json(items);
    } catch (error: any) {
      next(error);
    }
  });

  // Create action item for a case
  app.post("/api/cases/:id/action-items", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      const { description, assignee, dueDate, priority, transcriptId, sourceUtteranceIndex } = req.body;
      
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      // Get transcript for case if not provided
      let actualTranscriptId = transcriptId;
      if (!actualTranscriptId) {
        const transcript = await storage.getTranscriptByCase(caseId, userId);
        if (!transcript) {
          return res.status(400).json({ message: "No transcript found for this case" });
        }
        actualTranscriptId = transcript.id;
      }
      
      const item = await storage.createActionItem({
        caseId,
        transcriptId: actualTranscriptId,
        description,
        assignee: assignee || null,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        priority: priority || "medium",
        sourceUtteranceIndex: sourceUtteranceIndex || undefined,
      });
      
      await logAuditEvent(userId, "action_item_created", {
        caseId,
        metadata: {
          actionItemId: item.id,
          description: item.description.substring(0, 100),
          assignee: item.assignee,
          priority: item.priority,
        },
        req,
      });
      
      res.json(item);
    } catch (error: any) {
      next(error);
    }
  });

  // Update action item (mark complete, etc.)
  app.patch("/api/action-items/:id", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { completed, assignee, dueDate, priority, description, status } = req.body;
      
      // If trying to mark as complete, enforce approval-first policy
      // "AI-assisted, not AI-decided": items must be approved before completion
      if (completed === true) {
        const currentItem = await storage.getActionItem(id, userId);
        
        if (!currentItem) {
          return res.status(404).json({ message: "Action item not found or not authorized" });
        }
        
        if ((currentItem as any).status !== 'approved') {
          return res.status(400).json({ 
            message: "Action items must be approved before they can be marked as complete. This ensures solicitor oversight of all AI-generated content."
          });
        }
      }
      
      const updates: any = {};
      if (completed !== undefined) {
        updates.completed = completed;
        if (completed) {
          updates.completedAt = new Date();
          updates.completedBy = userId;
        } else {
          updates.completedAt = null;
          updates.completedBy = null;
        }
      }
      if (assignee !== undefined) updates.assignee = assignee;
      if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;
      if (priority !== undefined) updates.priority = priority;
      if (description !== undefined) updates.description = description;
      
      // Handle status/approval changes
      if (status !== undefined) {
        updates.status = status;
        if (status === 'approved') {
          updates.approvedBy = userId;
          updates.approvedAt = new Date();
        } else if (status === 'draft') {
          updates.approvedBy = null;
          updates.approvedAt = null;
        }
      }
      
      const item = await storage.updateActionItem(id, updates, userId);
      if (!item) {
        return res.status(404).json({ message: "Action item not found or not authorized" });
      }
      
      // Log appropriate audit event based on what changed
      if (status === 'approved') {
        await logAuditEvent(userId, "action_item_approved", {
          caseId: item.caseId,
          metadata: {
            actionItemId: id,
            description: item.description?.substring(0, 100),
            originalDescription: (item as any).originalDescription?.substring(0, 100),
            wasEdited: item.description !== (item as any).originalDescription,
            assignee: item.assignee,
            dueDate: item.dueDate,
          },
          severity: "info",
          req,
        });
      } else {
        await logAuditEvent(userId, "action_item_updated", {
          caseId: item.caseId,
          metadata: {
            actionItemId: id,
            updates: Object.keys(updates),
            completed: item.completed,
          },
          req,
        });
      }
      
      res.json(item);
    } catch (error: any) {
      next(error);
    }
  });
  
  // Bulk approve all action items for a case
  app.post("/api/cases/:id/action-items/approve-all", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const items = await storage.getActionItems(caseId, userId);
      const draftItems = items.filter(item => (item as any).status === 'draft');
      
      let approvedCount = 0;
      for (const item of draftItems) {
        await storage.updateActionItem(item.id, {
          status: 'approved',
          approvedBy: userId,
          approvedAt: new Date(),
        }, userId);
        approvedCount++;
      }
      
      await logAuditEvent(userId, "action_items_bulk_approved", {
        caseId,
        metadata: {
          approvedCount,
          totalItems: items.length,
        },
        severity: "info",
        req,
      });
      
      res.json({ success: true, approvedCount });
    } catch (error: any) {
      next(error);
    }
  });

  // Delete action item
  app.delete("/api/action-items/:id", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      const deleted = await storage.deleteActionItem(id, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Action item not found or not authorized" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      next(error);
    }
  });

  // Create manual action item (without transcript)
  app.post("/api/cases/:id/action-items/manual", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      const { description, assignee, dueDate, priority } = req.body;
      
      if (!description?.trim()) {
        return res.status(400).json({ message: "Description is required" });
      }
      
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const item = await storage.createManualActionItem({
        caseId,
        description: description.trim(),
        assignee: assignee || null,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        priority: priority || "medium",
        isManual: true,
      });
      
      await logAuditEvent(userId, "action_item_created_manual", {
        caseId,
        metadata: {
          actionItemId: item.id,
          description: item.description.substring(0, 100),
          assignee: item.assignee,
          priority: item.priority,
          isManual: true,
        },
        req,
      });
      
      res.json(item);
    } catch (error: any) {
      next(error);
    }
  });

  // Get pre-meeting briefing for a case
  app.get("/api/cases/:id/pre-meeting-briefing", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const briefing = await storage.getLatestPreMeetingBriefing(caseId, userId);
      res.json(briefing || null);
    } catch (error: any) {
      next(error);
    }
  });

  // Generate pre-meeting briefing for a case
  app.post("/api/cases/:id/pre-meeting-briefing", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const transcript = await storage.getTranscriptByCase(caseId, userId);
      const documents = await storage.getActiveDocumentsByCase(caseId, userId);
      
      if (!transcript) {
        return res.status(400).json({ message: "No transcript found for this case" });
      }
      
      // Import document service
      const { DocumentService } = await import("./services/documentService");
      const documentService = new DocumentService();
      
      const metadata = {
        title: caseData.title,
        clientName: caseData.clientName,
        matterReference: caseData.matterReference || undefined,
        recordingDate: new Date().toISOString().split('T')[0],
      };
      
      // Prepare meeting data from documents and transcript
      const attendanceNote = documents.find(d => d.type === 'attendance_note');
      const summary = documents.find(d => d.type === 'summary');
      
      const meetings = [{
        date: caseData.createdAt ? new Date(caseData.createdAt).toISOString().split('T')[0] : 'Unknown',
        transcript: transcript.content,
        attendanceNote: attendanceNote?.content,
        summary: summary?.content,
      }];
      
      const result = await documentService.generatePreMeetingBriefing(meetings, metadata);
      
      // Store the briefing
      const briefing = await storage.createPreMeetingBriefing({
        caseId,
        content: result.content,
        generatedBy: userId,
        sourceMeetingCount: meetings.length,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        cost: result.cost.toString(),
      });
      
      await logAuditEvent(userId, "pre_meeting_briefing_generated", {
        caseId,
        metadata: {
          briefingId: briefing.id,
          sourceMeetingCount: meetings.length,
          cost: result.cost,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        },
        req,
      });
      
      res.json({
        briefing,
        generationCost: result.cost,
      });
    } catch (error: any) {
      next(error);
    }
  });

  // Extract action items from transcript using AI
  app.post("/api/cases/:id/extract-action-items", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const transcript = await storage.getTranscriptByCase(caseId, userId);
      if (!transcript) {
        return res.status(400).json({ message: "No transcript found for this case" });
      }
      
      // Import document service dynamically
      const { DocumentService } = await import("./services/documentService");
      const documentService = new DocumentService();
      
      const metadata = {
        title: caseData.title,
        clientName: caseData.clientName,
        matterReference: caseData.matterReference || undefined,
        recordingDate: new Date().toISOString().split('T')[0],
      };
      
      const result = await documentService.extractActionItems(transcript.content, metadata);
      
      // Store extracted action items with originalDescription for audit trail
      const createdItems = [];
      for (const item of result.items) {
        const created = await storage.createActionItem({
          caseId,
          transcriptId: transcript.id,
          description: item.description,
          originalDescription: item.description, // Preserve AI-generated text for audit
          assignee: item.assignee || null,
          dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
          priority: item.priority || "medium",
          status: 'draft', // All AI-extracted items start as draft
        });
        createdItems.push(created);
      }
      
      await logAuditEvent(userId, "action_items_extracted", {
        caseId,
        metadata: {
          itemCount: createdItems.length,
          cost: result.cost,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        },
        req,
      });
      
      res.json({
        items: createdItems,
        extractionCost: result.cost,
      });
    } catch (error: any) {
      next(error);
    }
  });

  // Protected Object storage route
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res, next) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const userId = req.user.claims.sub;
      const objectPath = `/objects/${req.params.objectPath}`;
      
      // SECURITY: Verify ownership using centralized storage method
      const objectInfo = await storage.findObjectByPath(objectPath, userId);
      
      // Authorization: User must own the object
      // CRITICAL: If object is unknown (null) OR not owned, deny access
      // This prevents access to legacy paths, unknown object types, and unowned objects
      if (!objectInfo) {
        // Object not found in any table - deny access
        return res.sendStatus(403);
      }
      
      if (!objectInfo.owned) {
        // Object exists but user doesn't own it - deny access
        return res.sendStatus(403);
      }
      
      // Type-specific processing (currently only audio)
      if (objectInfo.type === 'audio') {
        const audioRecording = await storage.getAudioRecording(objectInfo.objectId);
        
        if (!audioRecording) {
          return res.sendStatus(404);
        }
        
        // GDPR Compliance: Check expiration and delete if expired
        if (new Date() > audioRecording.expiresAt && !audioRecording.deletedAt) {
          try {
            await objectStorageService.deleteObjectEntity(objectPath);
            await storage.updateAudioRecording(audioRecording.id, { deletedAt: new Date() });
            
            await logAuditEvent(userId, "audio_deleted", {
              caseId: audioRecording.caseId,
              audioRecordingId: audioRecording.id,
              metadata: {
                reason: "24hr_retention_policy_expiration",
                filePath: objectPath,
                expiresAt: audioRecording.expiresAt.toISOString(),
                deletedAt: new Date().toISOString(),
              },
              severity: "warning",
              req,
            });
          } catch (deleteError) {
            console.error("Failed to delete expired audio:", deleteError);
          }
          
          return res.status(410).json({ message: "Audio recording has expired (24hr retention policy)" });
        }
      }
      
      // Fetch and stream the object (ownership already verified)
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      next(error);
    }
  });

  // Audit trail API endpoints
  app.post("/api/audit/log", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { eventType, caseId, documentId, transcriptId, audioRecordingId, metadata, severity } = req.body;

      if (!eventType) {
        return res.status(400).json({ message: "eventType is required" });
      }

      await logAuditEvent(userId, eventType, {
        caseId,
        documentId,
        transcriptId,
        audioRecordingId,
        metadata,
        severity,
        req,
      });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/audit/logs", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId, documentId, eventType, startDate, endDate, limit } = req.query;

      const filters: any = {};
      if (caseId) filters.caseId = caseId as string;
      if (documentId) filters.documentId = documentId as string;
      if (eventType) filters.eventType = eventType as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (limit) filters.limit = parseInt(limit as string, 10);

      const logs = await storage.getAuditLogs(filters);

      await logAuditEvent(userId, "case_viewed", {
        metadata: { action: "audit_logs_queried", filters },
        req,
      });

      res.json(logs);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/audit/case/:caseId", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

      const logs = await storage.getAuditLogsByCase(caseId, limit);

      await logAuditEvent(userId, "case_viewed", {
        caseId,
        metadata: { action: "case_audit_history_viewed" },
        req,
      });

      res.json(logs);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/audit/export/signed-pdf", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId, eventType, startDate, endDate, limit } = req.body;

      const filters: any = {};
      if (caseId) filters.caseId = caseId;
      if (eventType) filters.eventType = eventType;
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);
      if (limit) filters.limit = limit;

      const logs = await storage.getAuditLogs(filters);

      if (logs.length === 0) {
        return res.status(400).json({ message: "No audit logs found matching filters" });
      }

      const user = await storage.getUser(userId);
      const firmProfile = await storage.getFirmProfile(userId);

      const pdfBuffer = generateSignedAuditPDF(logs, {
        generatedAt: new Date().toISOString(),
        generatedBy: user?.email || userId,
        filters: {
          caseId: caseId || undefined,
          eventType: eventType || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
        recordCount: logs.length,
        firmName: firmProfile?.firmName || undefined,
      });

      await logAuditEvent(userId, "document_downloaded", {
        metadata: {
          action: "audit_exported_signed_pdf",
          recordCount: logs.length,
          filters: { caseId, eventType, limit },
        },
        severity: "warning",
        req,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="audit-trail-signed-${Date.now()}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  });

  // Admin middleware
  const isAdmin = (req: any, res: Response, next: NextFunction) => {
    const userId = req.user?.claims?.sub;
    const ADMIN_USER_ID = process.env.ADMIN_USER_ID || "48381245";
    
    if (userId !== ADMIN_USER_ID) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  // Admin statistics endpoints
  app.get("/api/admin/statistics", isAuthenticated, isAdmin, async (req: any, res, next) => {
    try {
      const stats = await storage.getAdminStatistics();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/users", isAuthenticated, isAdmin, async (req: any, res, next) => {
    try {
      const userStats = await storage.getUserStatistics();
      res.json(userStats);
    } catch (error) {
      next(error);
    }
  });

  // Strategy documents API (admin only)
  app.get("/api/admin/docs", isAuthenticated, isAdmin, async (req: any, res, next) => {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const docsDir = path.join(process.cwd(), 'docs');
      
      const files = await fs.readdir(docsDir);
      const mdFiles = files.filter(f => f.endsWith('.md'));
      
      const docs = await Promise.all(mdFiles.map(async (filename) => {
        const filePath = path.join(docsDir, filename);
        const stats = await fs.stat(filePath);
        const content = await fs.readFile(filePath, 'utf-8');
        const firstLine = content.split('\n')[0].replace(/^#\s*/, '').trim();
        
        return {
          filename,
          title: firstLine || filename.replace('.md', '').replace(/_/g, ' '),
          size: stats.size,
          modifiedAt: stats.mtime.toISOString(),
        };
      }));
      
      res.json(docs);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/docs/:filename", isAuthenticated, isAdmin, async (req: any, res, next) => {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const { filename } = req.params;
      
      // Security: prevent directory traversal
      if (filename.includes('..') || filename.includes('/') || !filename.endsWith('.md')) {
        return res.status(400).json({ message: "Invalid filename" });
      }
      
      const filePath = path.join(process.cwd(), 'docs', filename);
      
      // Check file size before reading (limit to 1MB to prevent blocking)
      const stats = await fs.stat(filePath);
      const MAX_FILE_SIZE = 1024 * 1024; // 1MB
      if (stats.size > MAX_FILE_SIZE) {
        return res.status(413).json({ message: "File too large for PDF export" });
      }
      
      const content = await fs.readFile(filePath, 'utf-8');
      
      res.json({ filename, content });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ message: "Document not found" });
      }
      next(error);
    }
  });

  // Waitlist admin endpoints
  app.get("/api/admin/waitlist", isAuthenticated, isAdmin, async (req: any, res, next) => {
    try {
      const entries = await storage.getAllWaitlistEntries();
      res.json(entries);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/waitlist/stats", isAuthenticated, isAdmin, async (req: any, res, next) => {
    try {
      const stats = await storage.getWaitlistStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/waitlist/:id", isAuthenticated, isAdmin, async (req: any, res, next) => {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;
      
      const updates: any = {};
      if (status) updates.status = status;
      if (notes !== undefined) updates.notes = notes;
      
      if (status === 'invited') {
        updates.invitedAt = new Date();
        updates.invitedBy = req.user.claims.sub;
      }
      
      const entry = await storage.updateWaitlistEntry(id, updates);
      if (!entry) {
        return res.status(404).json({ message: "Waitlist entry not found" });
      }
      
      res.json(entry);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/waitlist/:id", isAuthenticated, isAdmin, async (req: any, res, next) => {
    try {
      const { id } = req.params;
      await storage.deleteWaitlistEntry(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // Firm profile routes (accessible to all authenticated users - public branding info)
  app.get("/api/firm-profile", isAuthenticated, async (req: any, res, next) => {
    try {
      const profile = await storage.getFirmProfile();
      res.json(profile || null);
    } catch (error) {
      next(error);
    }
  });

  // Update firm profile (admin only)
  app.put("/api/firm-profile", isAuthenticated, isAdmin, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertFirmProfileSchema.parse({
        ...req.body,
        updatedBy: userId,
      });
      
      const updatedProfile = await storage.upsertFirmProfile(validatedData);
      
      auditLogger.logFromRequest(AuditEventType.FIRM_PROFILE_UPDATED, req, {
        resourceId: updatedProfile.id,
        resourceType: "firm_profile",
        action: "update",
        severity: "medium",
      });
      
      res.json(updatedProfile);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  });

  // Get user preferences
  app.get("/api/user-preferences", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const preferences = await storage.getUserPreferences(userId);
      res.json(preferences || { userId, dismissedReviewBanner: false, completedOnboarding: false });
    } catch (error) {
      next(error);
    }
  });

  // Update user preferences
  app.put("/api/user-preferences", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const updatedPreferences = await storage.updateUserPreferences(userId, req.body);
      res.json(updatedPreferences);
    } catch (error) {
      next(error);
    }
  });

  // Admin usage statistics endpoint (deprecated - use /api/admin/statistics instead)
  app.get("/api/admin/usage-stats", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      
      // MVP: Admin user ID from environment or hardcoded
      // For production, move this to environment variable or database-driven role system
      const ADMIN_USER_ID = process.env.ADMIN_USER_ID || "48381245";
      
      if (userId !== ADMIN_USER_ID) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      // MVP: Get cases for the admin user to track their own API usage
      // For production with multiple users: implement storage.getAllCases() to aggregate across all users
      const allCases = await storage.getCases(userId);
      
      // Calculate date ranges
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Initialize stats
      let totalCostToday = 0;
      let totalCostWeek = 0;
      let totalCostMonth = 0;
      let totalCostAllTime = 0;
      const costPerUser: Record<string, number> = {};
      const recentExpensiveCases: Array<{ id: string; title: string; cost: number; createdAt: string; userId: string }> = [];
      const dailyCosts: Array<{ date: string; cost: number }> = [];
      
      // Calculate daily costs for last 7 days
      const dailyCostMap: Record<string, number> = {};
      for (let i = 0; i < 7; i++) {
        const date = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        dailyCostMap[dateStr] = 0;
      }
      
      // Process each case
      for (const caseData of allCases) {
        const metadata = (caseData.aiProcessingMetadata as any) || {};
        const cost = metadata.totalCost || 0;
        
        if (cost > 0) {
          const caseDate = new Date(caseData.createdAt);
          const dateStr = caseDate.toISOString().split('T')[0];
          
          // Total costs
          totalCostAllTime += cost;
          
          if (caseDate >= todayStart) {
            totalCostToday += cost;
          }
          if (caseDate >= weekStart) {
            totalCostWeek += cost;
            
            // Daily costs
            if (dailyCostMap.hasOwnProperty(dateStr)) {
              dailyCostMap[dateStr] += cost;
            }
          }
          if (caseDate >= monthStart) {
            totalCostMonth += cost;
          }
          
          // Cost per user
          costPerUser[caseData.createdBy] = (costPerUser[caseData.createdBy] || 0) + cost;
          
          // Recent expensive cases
          recentExpensiveCases.push({
            id: caseData.id,
            title: caseData.title,
            cost,
            createdAt: caseData.createdAt.toISOString(),
            userId: caseData.createdBy,
          });
        }
      }
      
      // Sort and limit expensive cases
      recentExpensiveCases.sort((a, b) => b.cost - a.cost);
      const topExpensiveCases = recentExpensiveCases.slice(0, 10);
      
      // Convert daily costs to array
      for (const [date, cost] of Object.entries(dailyCostMap)) {
        dailyCosts.push({ date, cost });
      }
      dailyCosts.sort((a, b) => a.date.localeCompare(b.date));
      
      // Sort cost per user
      const topUsers = Object.entries(costPerUser)
        .map(([userId, cost]) => ({ userId, cost }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 10);
      
      res.json({
        totalCostToday,
        totalCostWeek,
        totalCostMonth,
        totalCostAllTime,
        topUsers,
        topExpensiveCases,
        dailyCosts,
        totalCasesProcessed: allCases.filter((c: any) => (c.aiProcessingMetadata as any)?.totalCost > 0).length,
      });
    } catch (error) {
      next(error);
    }
  });

  // OAuth state management (CSRF protection)
  // In-memory store for OAuth state tokens (expires after 10 minutes)
  const oauthStateStore = new Map<string, { userId: string; provider: string; createdAt: number; popup?: boolean }>();
  
  // Cleanup expired OAuth states every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [state, data] of Array.from(oauthStateStore.entries())) {
      if (now - data.createdAt > 10 * 60 * 1000) { // 10 minutes
        oauthStateStore.delete(state);
      }
    }
  }, 5 * 60 * 1000);

  // OAuth Calendar Integration Routes
  
  // Direct OAuth connect route (for Settings page navigation)
  // GET endpoint that redirects to the OAuth authorization URL
  app.get("/api/oauth/connect/:provider", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const provider = req.params.provider;
      
      if (provider !== 'google') {
        return res.status(400).json({ message: "Invalid provider. Only 'google' is supported" });
      }

      // Create signed OAuth state
      const statePayload: OAuthStatePayload = {
        userId,
        provider: 'google',
        popup: false,
        nonce: generateSecureNonce(),
        createdAt: Date.now(),
      };

      const signedState = signOAuthState(statePayload);

      // Get base URL from request
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers.host;
      const baseUrl = `${protocol}://${host}`;

      try {
        const client = createGoogleOAuthClient(baseUrl);
        const authUrl = getGoogleAuthUrl(client, signedState);
        console.log('[OAUTH] Generated Google auth URL:', authUrl);
        console.log('[OAUTH] Redirect URI used:', `${baseUrl}/api/calendar/callback/google`);

        // Redirect to OAuth authorization URL
        console.log('[OAUTH] Redirecting to:', authUrl);
        return res.redirect(authUrl);
      } catch (configError: any) {
        console.error(`[OAUTH] Failed to create Google OAuth client:`, configError.message);
        return res.status(503).json({
          message: `Google OAuth is not configured. Please contact your administrator.`,
        });
      }
    } catch (error) {
      next(error);
    }
  });

  // Initiate OAuth flow for calendar provider
  // Accepts optional sync context (caseId, deadline) for auto-sync after OAuth
  app.post("/api/calendar/auth/:provider", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const provider = req.params.provider;
      const popup = req.query.popup === 'true';
      
      if (provider !== 'google' && provider !== 'outlook') {
        return res.status(400).json({ message: "Invalid provider. Only 'google' and 'outlook' are supported" });
      }

      // Optional sync context from request body
      const { caseId, deadline, notes, priority, isAllDay } = req.body || {};

      // Handle Outlook via Replit connector - check if already connected
      if (provider === 'outlook') {
        const isConnected = await isReplitOutlookConnected();
        if (!isConnected) {
          return res.status(503).json({
            message: "Outlook is not connected. Please connect Outlook via the Replit Tools pane first.",
            requiresReplitSetup: true,
          });
        }

        // Persist Outlook integration record so downstream flows can detect connection
        const outlookEmail = await getOutlookUserEmail();
        await storage.saveCalendarIntegration({
          userId,
          provider: 'outlook',
          accessToken: 'replit-managed', // Token is managed by Replit connector
          email: outlookEmail || undefined,
        });

        // Outlook is connected - attempt auto-sync if context provided
        if (caseId && deadline) {
          try {
            const caseData = await storage.getCase(caseId);
            if (caseData && caseData.createdBy === userId) {
              const eventData = {
                caseId,
                title: caseData.title,
                clientName: caseData.clientName,
                matterReference: caseData.matterReference || undefined,
                deadline: new Date(deadline).toISOString(),
                notes: notes || '',
                priority: priority || 'normal',
                isAllDay: isAllDay || false,
              };
              
              const result = await createReplitOutlookEvent(eventData);
              
              if (result.success && result.eventId) {
                await storage.createCalendarEvent({
                  caseId,
                  userId,
                  provider: 'outlook',
                  providerEventId: result.eventId,
                  eventType: 'deadline',
                  title: `Deadline: ${caseData.title}`,
                  deadline: new Date(deadline),
                  isAllDay: isAllDay || false,
                });
                
                await storage.updateCase(caseId, {
                  calendarSyncStatus: 'synced',
                  calendarEventId: result.eventId,
                  calendarProvider: 'outlook',
                });
              }
              
              return res.json({ 
                success: result.success, 
                message: result.success ? "Calendar synced via Outlook" : result.error,
                provider: 'outlook',
              });
            }
          } catch (syncError: any) {
            console.error('[Outlook] Auto-sync failed:', syncError);
            return res.status(500).json({
              message: "Failed to sync to Outlook calendar",
              error: syncError.message,
            });
          }
        }
        
        return res.json({ 
          success: true, 
          connected: true, 
          message: "Outlook is connected via Replit",
        });
      }

      // Google OAuth flow
      // Create signed OAuth state with sync context
      const statePayload: OAuthStatePayload = {
        userId,
        provider: 'google',
        popup,
        nonce: generateSecureNonce(),
        createdAt: Date.now(),
      };

      // Add sync context if provided
      if (caseId && deadline) {
        statePayload.syncContext = {
          caseId, // UUID string - no parsing needed
          deadline: new Date(deadline).toISOString(),
          notes: notes || undefined,
          priority: priority || 'normal',
          isAllDay: isAllDay || false,
        };
      }

      // Sign the state token
      const signedState = signOAuthState(statePayload);

      // Get base URL from request
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers.host;
      const baseUrl = `${protocol}://${host}`;

      try {
        const client = createGoogleOAuthClient(baseUrl);
        const authUrl = getGoogleAuthUrl(client, signedState);

        // Return auth URL for frontend to redirect
        res.json({ authUrl });
      } catch (error: any) {
        // OAuth credentials not configured
        if (error.message.includes('not configured')) {
          return res.status(503).json({
            message: `Google OAuth is not configured. Please contact your administrator.`,
            details: error.message,
          });
        }
        throw error;
      }
    } catch (error) {
      next(error);
    }
  });

  // OAuth callback handler with auto-sync support
  app.get("/api/calendar/callback/:provider", async (req: any, res, next) => {
    try {
      const provider = req.params.provider;
      const { code, state, error: oauthError } = req.query;

      // Always redirect to /oauth/callback - it handles both popup and mobile flows
      const redirectBase = '/oauth/callback';

      // Check for OAuth errors
      if (oauthError) {
        return res.redirect(`${redirectBase}?calendar_error=${encodeURIComponent(oauthError)}`);
      }

      if (!code || !state) {
        return res.redirect(`${redirectBase}?calendar_error=missing_code_or_state`);
      }

      // Verify and decode signed state token
      const stateData = verifyOAuthState(state as string);
      
      if (!stateData) {
        console.error('Invalid or expired OAuth state token');
        return res.redirect(`${redirectBase}?calendar_error=invalid_state`);
      }

      // Verify provider matches
      if (stateData.provider !== provider) {
        return res.redirect(`${redirectBase}?calendar_error=provider_mismatch`);
      }

      // Get base URL
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers.host;
      const baseUrl = `${protocol}://${host}`;

      try {
        if (provider !== 'google') {
          return res.redirect(`${redirectBase}?calendar_error=invalid_provider`);
        }

        const client = createGoogleOAuthClient(baseUrl);
        const tokenData = await exchangeGoogleCode(client, code as string);

        // Save calendar integration to storage
        await storage.saveCalendarIntegration({
          userId: stateData.userId,
          provider: 'google',
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken || undefined,
          expiresAt: tokenData.expiresAt || undefined,
          email: tokenData.email || undefined,
        });

        // Log audit event
        await storage.createAuditLog({
          eventType: 'calendar_connected',
          userId: stateData.userId,
          metadata: {
            provider,
            email: tokenData.email || 'N/A',
          },
          severity: 'info',
        });

        // If sync context exists, attempt to create calendar event immediately
        if (stateData.syncContext) {
          const { caseId, deadline, notes, priority, isAllDay } = stateData.syncContext;
          
          try {
            // Get case data for event details
            const caseData = await storage.getCase(caseId, stateData.userId);
            
            if (!caseData) {
              console.error(`Case ${caseId} not found for auto-sync`);
              return res.redirect(`${redirectBase}?calendar_connected=${provider}&sync_error=case_not_found`);
            }

            // Create calendar event with retry logic
            const maxRetries = 3;
            let lastError: any = null;
            
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
              try {
                const result = await createCalendarEvent(
                  stateData.userId,
                  {
                    caseId,
                    title: caseData.title,
                    clientName: caseData.clientName,
                    matterReference: caseData.matterReference || undefined,
                    deadline: new Date(deadline),
                    notes: notes || undefined,
                    priority: priority || 'normal',
                    isAllDay: isAllDay || false,
                  },
                  storage
                );

                if (!result.success) {
                  throw new Error(result.error || 'Calendar event creation failed');
                }

                // Save calendar event to database
                if (result.eventId) {
                  await storage.createCalendarEvent({
                    caseId,
                    userId: stateData.userId,
                    provider: 'google',
                    providerEventId: result.eventId,
                    eventType: 'deadline',
                  });
                }

                // Update case to mark as synced
                await storage.updateCase(caseId, {
                  syncToCalendar: true,
                }, stateData.userId);

                // Log successful sync
                await storage.createAuditLog({
                  eventType: 'calendar_event_created',
                  userId: stateData.userId,
                  caseId,
                  metadata: {
                    provider,
                    eventTitle: `${caseData.clientName} - ${caseData.caseType}`,
                    deadline: deadline,
                    autoSync: true,
                  },
                  severity: 'info',
                });

                // Success! Redirect to case page with success message
                return res.redirect(`${redirectBase}?calendar_connected=${provider}&sync_success=true&case_id=${caseId}`);
              } catch (error: any) {
                lastError = error;
                console.error(`Calendar event creation attempt ${attempt}/${maxRetries} failed:`, error);
                
                // Exponential backoff: wait before retry
                if (attempt < maxRetries) {
                  await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                }
              }
            }

            // All retries failed
            console.error(`Calendar event creation failed after ${maxRetries} attempts:`, lastError);
            return res.redirect(`${redirectBase}?calendar_connected=${provider}&sync_error=event_creation_failed&case_id=${caseId}`);
          } catch (error: any) {
            console.error('Auto-sync error:', error);
            return res.redirect(`${redirectBase}?calendar_connected=${provider}&sync_error=unknown&case_id=${caseId}`);
          }
        }

        // No sync context - just redirect with connection success
        res.redirect(`${redirectBase}?calendar_connected=${provider}`);
      } catch (error: any) {
        console.error(`OAuth token exchange failed for ${provider}:`, error);
        res.redirect(`${redirectBase}?calendar_error=token_exchange_failed`);
      }
    } catch (error) {
      next(error);
    }
  });

  // Get user's calendar connections (list format)
  app.get("/api/calendar/connections", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const connections = await storage.getUserCalendarIntegrations(userId);
      
      // Return safe data (don't expose tokens)
      const safeConnections = connections.map(conn => ({
        provider: conn.provider,
        email: conn.email,
        connectedAt: conn.connectedAt,
        isExpired: conn.expiresAt ? new Date(conn.expiresAt) < new Date() : false,
      }));
      
      res.json(safeConnections);
    } catch (error) {
      next(error);
    }
  });

  // Get user's OAuth connections (object format for Settings UI)
  app.get("/api/oauth/connections", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      
      // Check Replit-managed connections first
      const replitGoogleConnected = await isReplitCalendarConnected();
      const replitOutlookConnected = await isReplitOutlookConnected();
      
      // Get user's own OAuth connections
      const providers = await getConnectedProviders(userId, storage);
      
      // If Replit Google connection is available, override Google status
      if (replitGoogleConnected) {
        providers.google = {
          connected: true,
          email: 'Connected via Replit',
          connectedAt: new Date().toISOString(),
        };
      }
      
      // If Replit Outlook connection is available, persist it and override status
      if (replitOutlookConnected) {
        const outlookEmail = await getOutlookUserEmail();
        
        // Persist Outlook integration so downstream sync routes can detect it
        await storage.saveCalendarIntegration({
          userId,
          provider: 'outlook',
          accessToken: 'replit-managed',
          email: outlookEmail || undefined,
        });
        
        providers.outlook = {
          connected: true,
          email: outlookEmail || 'Connected via Replit',
          connectedAt: new Date().toISOString(),
        };
      }
      
      res.json(providers);
    } catch (error) {
      next(error);
    }
  });

  // OAuth configuration diagnostic endpoint (shows exact redirect URIs needed)
  app.get("/api/calendar/oauth-config", isAuthenticated, async (req: any, res, next) => {
    try {
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers.host;
      const baseUrl = `${protocol}://${host}`;

      const config = {
        baseUrl,
        redirectUris: {
          google: `${baseUrl}/api/calendar/callback/google`,
        },
        instructions: {
          google: {
            step1: "Go to Google Cloud Console: https://console.cloud.google.com/apis/credentials",
            step2: "Select your OAuth 2.0 Client ID",
            step3: `Add this to 'Authorized redirect URIs': ${baseUrl}/api/calendar/callback/google`,
            step4: "Click Save",
          },
        },
        status: {
          googleConfigured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        },
      };

      res.json(config);
    } catch (error) {
      next(error);
    }
  });

  // Disconnect calendar
  app.delete("/api/calendar/disconnect/:provider", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const provider = req.params.provider;

      if (provider !== 'google') {
        return res.status(400).json({ message: "Invalid provider. Only 'google' is supported" });
      }

      await storage.deleteCalendarIntegration(userId, 'google');

      // Log audit event
      await storage.createAuditLog({
        eventType: 'calendar_disconnected',
        userId,
        metadata: {
          provider,
        },
        severity: 'info',
      });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Legacy calendar status route (will be deprecated - use /api/oauth/connections instead)
  app.get("/api/calendar/status", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const providers = await getConnectedProviders(userId, storage);
      res.json(providers);
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/cases/:id/sync-calendar", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { provider, notes, priority, isAllDay } = req.body;

      console.log('[SYNC] Calendar sync requested:', {
        caseId: req.params.id,
        userId,
        provider,
        hasNotes: !!notes,
        priority,
        isAllDay,
      });

      if (!provider || !['google', 'outlook'].includes(provider)) {
        return res.status(400).json({ message: "Invalid provider. Supported: 'google', 'outlook'" });
      }

      // Get case and verify access
      const caseData = await storage.getCase(req.params.id, userId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }

      console.log('[SYNC] Case found:', {
        title: caseData.title,
        deadline: caseData.deadline?.toISOString(),
      });

      // Check if case has a deadline
      if (!caseData.deadline) {
        return res.status(400).json({ message: "Case must have a deadline to sync to calendar" });
      }

      // Prepare event data with notes, priority, and isAllDay flag
      const eventData = {
        caseId: req.params.id,
        title: caseData.title,
        clientName: caseData.clientName,
        matterReference: caseData.matterReference || undefined,
        deadline: new Date(caseData.deadline),
        notes: notes || caseData.textNotes || undefined,
        priority: priority || caseData.priority || 'normal',
        isAllDay: isAllDay !== undefined ? isAllDay : false,
      };

      // Check if event already exists for this provider
      const existingEvent = await storage.getCalendarEventByProvider(req.params.id, userId, provider);

      let result: { success: boolean; eventId?: string; error?: string; provider?: string };
      
      // Handle Outlook calendar sync
      if (provider === 'outlook') {
        const replitOutlookConnected = await isReplitOutlookConnected();
        
        if (!replitOutlookConnected) {
          return res.status(400).json({ message: "Outlook calendar is not connected. Please connect via Settings." });
        }
        
        console.log('[SYNC] Using Replit-managed Outlook Calendar connection');
        
        if (existingEvent) {
          console.log('[SYNC] Updating existing Outlook calendar event:', existingEvent.providerEventId);
          const updateResult = await updateReplitOutlookEvent(existingEvent.providerEventId, {
            title: caseData.title,
            clientName: caseData.clientName,
            matterReference: caseData.matterReference || undefined,
            deadline: eventData.deadline.toISOString(),
            notes: eventData.notes,
            priority: eventData.priority,
            isAllDay: eventData.isAllDay,
          });
          result = { ...updateResult, provider: 'outlook' };
          
          if (result.success) {
            await storage.updateCalendarEvent(existingEvent.id, {
              lastUpdatedAt: new Date(),
            });
          }
        } else {
          console.log('[SYNC] Creating new Outlook calendar event via Replit connector');
          const createResult = await createReplitOutlookEvent({
            caseId: req.params.id,
            title: caseData.title,
            clientName: caseData.clientName,
            matterReference: caseData.matterReference || undefined,
            deadline: eventData.deadline.toISOString(),
            notes: eventData.notes,
            priority: eventData.priority,
            isAllDay: eventData.isAllDay,
          });
          result = { ...createResult, provider: 'outlook' };
          
          console.log('[SYNC] Outlook create result:', result);
          
          if (result.success && result.eventId) {
            console.log('[SYNC] Saving Outlook calendar event to database');
            await storage.createCalendarEvent({
              caseId: req.params.id,
              userId: userId,
              provider: 'outlook',
              providerEventId: result.eventId,
              eventType: 'deadline',
            });
          }
        }
      }
      // Handle Google calendar sync
      else if (provider === 'google') {
        const replitConnected = await isReplitCalendarConnected();
        
        if (replitConnected) {
          console.log('[SYNC] Using Replit-managed Google Calendar connection');
          
          if (existingEvent) {
            console.log('[SYNC] Updating existing calendar event:', existingEvent.providerEventId);
            const updateResult = await updateReplitCalendarEvent(existingEvent.providerEventId, {
              title: caseData.title,
              deadline: eventData.deadline.toISOString(),
              notes: eventData.notes,
              priority: eventData.priority,
              isAllDay: eventData.isAllDay,
            });
            result = { ...updateResult, provider: 'google' };
            
            if (result.success) {
              await storage.updateCalendarEvent(existingEvent.id, {
                lastUpdatedAt: new Date(),
              });
            }
          } else {
            console.log('[SYNC] Creating new calendar event via Replit connector');
            const createResult = await createReplitCalendarEvent({
              caseId: req.params.id,
              title: caseData.title,
              deadline: eventData.deadline.toISOString(),
              notes: eventData.notes,
              priority: eventData.priority,
              isAllDay: eventData.isAllDay,
            });
            result = { ...createResult, provider: 'google' };
            
            console.log('[SYNC] Replit create result:', result);
            
            if (result.success && result.eventId) {
              console.log('[SYNC] Saving calendar event to database');
              await storage.createCalendarEvent({
                caseId: req.params.id,
                userId: userId,
                provider: provider,
                providerEventId: result.eventId,
                eventType: 'deadline',
              });
            }
          }
        } else {
          // Fall back to user's own OAuth connection
          console.log('[SYNC] Replit connection not available, using user OAuth');
          if (existingEvent) {
            result = await updateCalendarEvent(userId, existingEvent.providerEventId, eventData, storage);
            if (result.success) {
              await storage.updateCalendarEvent(existingEvent.id, { lastUpdatedAt: new Date() });
            }
          } else {
            result = await createCalendarEvent(userId, eventData, storage);
            if (result.success && result.eventId) {
              await storage.createCalendarEvent({
                caseId: req.params.id,
                userId: userId,
                provider: 'google',
                providerEventId: result.eventId,
                eventType: 'deadline',
              });
            }
          }
        }
      }

      if (result.success) {
        console.log('[SYNC] ✅ Calendar sync successful');
        // Update case to mark calendar sync enabled
        await storage.updateCase(req.params.id, { syncToCalendar: true }, userId);

        await logAuditEvent(userId, "calendar_synced", {
          caseId: req.params.id,
          metadata: { provider, action: existingEvent ? 'update' : 'create' },
          req,
        });

        res.json({ success: true, provider: result.provider });
      } else {
        console.error('[SYNC] ❌ Calendar sync failed:', result.error);
        await logAuditEvent(userId, "calendar_sync_failed", {
          caseId: req.params.id,
          metadata: { provider, error: result.error },
          req,
        });

        // Check if this is an OAuth token expiry issue
        const isTokenExpired = result.error === 'invalid_grant' || 
                               result.error?.includes('invalid_grant') ||
                               result.error?.includes('Token has been expired') ||
                               result.error?.includes('Token has been revoked');

        if (isTokenExpired) {
          // Don't delete the connection - just inform user they need to reconnect
          // User can manually reconnect in Settings to get fresh tokens
          res.status(401).json({ 
            success: false, 
            message: "Your calendar connection has expired. Please go to Settings and reconnect your calendar.",
            error: 'token_expired',
            requiresReconnect: true,
          });
        } else {
          res.status(500).json({ 
            success: false, 
            message: "Failed to sync to calendar",
            error: result.error 
          });
        }
      }
    } catch (error: any) {
      console.error('[SYNC] ❌ Exception during sync:', error);
      next(error);
    }
  });

  app.delete("/api/cases/:id/unsync-calendar", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { provider } = req.body;

      if (provider && !['google', 'outlook'].includes(provider)) {
        return res.status(400).json({ message: "Invalid provider. Supported: 'google', 'outlook'" });
      }

      // Get case and verify access
      const caseData = await storage.getCase(req.params.id, userId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }

      // Get calendar events for this case
      const events = await storage.getCalendarEventsByCase(req.params.id, userId);
      
      // Filter by provider if specified
      const eventsToDelete = provider 
        ? events.filter(e => e.provider === provider)
        : events;

      // Delete events from calendars and database
      for (const event of eventsToDelete) {
        if (event.provider === 'outlook') {
          await deleteReplitOutlookEvent(event.providerEventId);
        } else {
          await deleteCalendarEvent(userId, event.providerEventId, storage);
        }
        await storage.deleteCalendarEvent(event.id);
      }

      // Update case to mark calendar sync disabled if all events deleted
      const remainingEvents = await storage.getCalendarEventsByCase(req.params.id, userId);
      if (remainingEvents.length === 0) {
        await storage.updateCase(req.params.id, { syncToCalendar: false }, userId);
      }

      res.json({ success: true, deletedCount: eventsToDelete.length });
    } catch (error: any) {
      next(error);
    }
  });

  // Log document export/download events
  app.post("/api/cases/:id/audit/track-change", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { action, changeId } = req.body;
      
      const caseData = await storage.getCase(req.params.id, userId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }

      await logAuditEvent(userId, "track_change_action", {
        caseId: req.params.id,
        metadata: { 
          action,
          changeId: changeId || null,
        },
        req,
      });
      
      res.json({ success: true });
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/cases/:id/audit/export", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { format, documents: exportedDocs } = req.body;
      
      // Verify user has access to the case
      const caseData = await storage.getCase(req.params.id, userId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }

      await logAuditEvent(userId, "documents_exported", {
        caseId: req.params.id,
        metadata: { 
          format: format || 'pdf',
          documents: exportedDocs || [],
          documentCount: exportedDocs?.length || 0,
        },
        req,
      });
      
      // Track document versions exported (for client version tracking)
      const allCaseDocuments = await storage.getActiveDocumentsByCase(req.params.id, userId);
      for (const doc of allCaseDocuments) {
        if ((exportedDocs || []).includes(doc.type)) {
          await storage.createClientVersionTracking({
            documentId: doc.id,
            sentToClient: true,
            sentAt: new Date(),
            sentBy: userId,
            sentMethod: 'download',
            amendmentReason: null,
            versionChangeWarned: false,
          });
        }
      }
      
      res.json({ success: true });
    } catch (error: any) {
      next(error);
    }
  });

  // ============================================
  // Recall.ai Video Conferencing Integration
  // ============================================
  
  // Check if Recall.ai is configured
  app.get("/api/recall/status", isAuthenticated, async (req: any, res, next) => {
    try {
      const { recallService } = await import("./services/recallService");
      const userId = req.user.claims.sub;
      
      const connection = await storage.getRecallConnection(userId);
      const isConfigured = recallService.isConfigured();
      
      res.json({
        configured: isConfigured,
        connected: connection?.status === 'active',
        connection: connection ? {
          status: connection.status,
          connectedAt: connection.connectedAt,
          lastSyncAt: connection.lastSyncAt,
        } : null,
      });
    } catch (error) {
      next(error);
    }
  });
  
  // Connect to Recall.ai (validate API key and create connection)
  app.post("/api/recall/connect", isAuthenticated, async (req: any, res, next) => {
    try {
      const { recallService } = await import("./services/recallService");
      const userId = req.user.claims.sub;
      
      const result = await recallService.validateConnection(userId);
      
      if (result.valid) {
        await storage.createAuditLog({
          eventType: 'recall_connected',
          userId,
          metadata: { message: result.message },
          severity: 'info',
        });
      }
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
  
  // Disconnect from Recall.ai
  app.delete("/api/recall/disconnect", isAuthenticated, async (req: any, res, next) => {
    try {
      const { recallService } = await import("./services/recallService");
      const userId = req.user.claims.sub;
      
      await recallService.disconnectUser(userId);
      
      await storage.createAuditLog({
        eventType: 'recall_disconnected',
        userId,
        metadata: {},
        severity: 'info',
      });
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });
  
  // List available meetings for import
  app.get("/api/recall/meetings", isAuthenticated, async (req: any, res, next) => {
    try {
      const { recallService } = await import("./services/recallService");
      const userId = req.user.claims.sub;
      
      // Check if user is connected
      const connection = await storage.getRecallConnection(userId);
      if (!connection || connection.status !== 'active') {
        return res.status(400).json({ message: "Not connected to Recall.ai" });
      }
      
      const meetings = await recallService.getImportableMeetings(userId);
      res.json(meetings);
    } catch (error) {
      next(error);
    }
  });
  
  // Get user's meeting imports
  app.get("/api/recall/imports", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const imports = await storage.getMeetingImportsByUser(userId);
      res.json(imports);
    } catch (error) {
      next(error);
    }
  });
  
  // Start importing a meeting
  app.post("/api/recall/import", isAuthenticated, async (req: any, res, next) => {
    try {
      const { recallService } = await import("./services/recallService");
      const userId = req.user.claims.sub;
      const { botId, caseId, preConsentEmailId } = req.body;
      // SECURITY: Never trust client-provided consentConfirmed - always verify server-side
      
      if (!botId) {
        return res.status(400).json({ message: "Bot ID is required" });
      }
      
      // Check if user is connected
      const connection = await storage.getRecallConnection(userId);
      if (!connection || connection.status !== 'active') {
        return res.status(400).json({ message: "Not connected to Recall.ai" });
      }
      
      // Verify case access if provided
      if (caseId) {
        const caseData = await storage.getCase(caseId, userId);
        if (!caseData) {
          return res.status(404).json({ message: "Case not found" });
        }
      }
      
      // Server-side consent verification from pre-consent email acknowledgement
      let hasValidConsent = false;
      if (preConsentEmailId) {
        const consentEmail = await storage.getPreConsentEmail(preConsentEmailId);
        if (consentEmail && consentEmail.consentAcknowledged && consentEmail.userId === userId) {
          hasValidConsent = true;
        }
      }
      
      // Start the import with server-verified consent status
      const meetingImport = await recallService.startMeetingImport(
        userId,
        botId,
        caseId,
        hasValidConsent, // Only true if we verified server-side
        preConsentEmailId
      );
      
      await storage.createAuditLog({
        eventType: 'meeting_import_started',
        userId,
        caseId: caseId || undefined,
        metadata: {
          botId,
          platform: meetingImport.meetingPlatform,
          consentVerified: hasValidConsent,
          preConsentEmailId: preConsentEmailId || null,
        },
        severity: 'info',
      });
      
      res.json(meetingImport);
    } catch (error) {
      next(error);
    }
  });
  
  // Get import status
  app.get("/api/recall/import/:importId", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const importData = await storage.getMeetingImport(req.params.importId);
      
      if (!importData || importData.userId !== userId) {
        return res.status(404).json({ message: "Import not found" });
      }
      
      res.json(importData);
    } catch (error) {
      next(error);
    }
  });
  
  // Process an import (download audio and trigger transcription)
  app.post("/api/recall/import/:importId/process", isAuthenticated, async (req: any, res, next) => {
    try {
      const { recallService } = await import("./services/recallService");
      const userId = req.user.claims.sub;
      const importData = await storage.getMeetingImport(req.params.importId);
      
      // Security: Verify import belongs to authenticated user
      if (!importData || importData.userId !== userId) {
        return res.status(404).json({ message: "Import not found" });
      }
      
      // Security: Verify case ownership if a case is linked
      if (importData.caseId) {
        const linkedCase = await storage.getCase(importData.caseId, userId);
        if (!linkedCase) {
          return res.status(403).json({ 
            message: "Access denied: You don't have permission to process this import for the linked case" 
          });
        }
      }
      
      if (importData.status !== 'pending') {
        return res.status(400).json({ message: `Import is already ${importData.status}` });
      }
      
      // GDPR: Server-side consent verification
      // Don't trust client-provided consentConfirmed - verify against pre-consent emails or require explicit confirmation
      let hasValidConsent = false;
      
      // Check if there's an acknowledged pre-consent email for this meeting
      if (importData.preConsentEmailId) {
        const consentEmail = await storage.getPreConsentEmail(importData.preConsentEmailId);
        if (consentEmail && consentEmail.consentAcknowledged && consentEmail.userId === userId) {
          hasValidConsent = true;
        }
      }
      
      // If no pre-consent email, check the import's consent confirmation status
      // This is set via the /consent endpoint which should be called after user confirms in UI
      if (!hasValidConsent && importData.consentConfirmed) {
        // Consent was confirmed through the UI workflow
        hasValidConsent = true;
      }
      
      if (!hasValidConsent) {
        return res.status(400).json({ 
          message: "Consent must be confirmed before processing",
          requiresConsent: true 
        });
      }
      
      // Update status to downloading
      await storage.updateMeetingImport(importData.id, { status: 'downloading' });
      
      try {
        // Get the recording from Recall.ai
        const recording = await recallService.getBotRecording(importData.recallBotId);
        if (!recording || !recording.media?.audio_url) {
          throw new Error('No audio recording available');
        }
        
        // Download the audio
        const audioBuffer = await recallService.downloadAudio(recording.media.audio_url);
        
        // Store in object storage
        const objectStorage = await import("./objectStorage");
        const audioPath = `.private/imports/${importData.id}/audio.mp3`;
        await objectStorage.uploadObject(audioPath, audioBuffer, 'audio/mpeg');
        
        // Calculate Recall.ai cost for this import
        const { calculateRecallAICost } = await import("./config/openai");
        const recallCost = importData.durationSeconds 
          ? calculateRecallAICost(importData.durationSeconds) 
          : 0;
        
        // Update with audio path and cost
        await storage.updateMeetingImport(importData.id, { 
          status: 'transcribing',
          audioStoragePath: audioPath,
          importedAt: new Date(),
        });
        
        // If there's a linked case, trigger transcription
        if (importData.caseId) {
          // Store Recall.ai cost in case metadata for billing visibility
          const existingCase = await storage.getCase(importData.caseId, userId);
          if (existingCase) {
            const currentMetadata = existingCase.aiProcessingMetadata || {};
            await storage.updateCase(importData.caseId, {
              aiProcessingMetadata: {
                ...currentMetadata,
                recallAiCost: recallCost,
                recordingSource: 'video_import',
                meetingPlatform: importData.meetingPlatform,
                meetingDurationSeconds: importData.durationSeconds,
              },
            }, userId);
          }
          // Create audio recording entry
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7); // 7 day retention
          
          await storage.createAudioRecording({
            caseId: importData.caseId,
            filePath: audioPath,
            mimeType: 'audio/mpeg',
            duration: importData.durationSeconds || undefined,
            expiresAt,
          });
          
          // Trigger processing
          const caseData = await storage.getCase(importData.caseId, userId);
          if (caseData) {
            await storage.updateCase(importData.caseId, { status: 'processing' }, userId);
            
            // Trigger async transcription
            const { processCase } = await import("./processingService");
            processCase(importData.caseId, userId).then(async () => {
              await storage.updateMeetingImport(importData.id, { status: 'completed' });
              await storage.createAuditLog({
                eventType: 'meeting_import_completed',
                userId,
                caseId: importData.caseId || undefined,
                metadata: { importId: importData.id },
                severity: 'info',
              });
            }).catch(async (err) => {
              console.error('Meeting import processing failed:', err);
              await storage.updateMeetingImport(importData.id, { 
                status: 'failed',
                errorMessage: err.message,
              });
              await storage.createAuditLog({
                eventType: 'meeting_import_failed',
                userId,
                caseId: importData.caseId || undefined,
                metadata: { importId: importData.id, error: err.message },
                severity: 'warning',
              });
            });
          }
        } else {
          // Mark as completed (user needs to link to a case later)
          await storage.updateMeetingImport(importData.id, { status: 'completed' });
        }
        
        res.json({ success: true, status: 'processing' });
      } catch (error: any) {
        await storage.updateMeetingImport(importData.id, { 
          status: 'failed',
          errorMessage: error.message,
        });
        throw error;
      }
    } catch (error) {
      next(error);
    }
  });
  
  // Link import to a case
  app.patch("/api/recall/import/:importId/link-case", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId } = req.body;
      
      if (!caseId) {
        return res.status(400).json({ message: "Case ID is required" });
      }
      
      const importData = await storage.getMeetingImport(req.params.importId);
      if (!importData || importData.userId !== userId) {
        return res.status(404).json({ message: "Import not found" });
      }
      
      // Verify case access
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      await storage.updateMeetingImport(importData.id, { caseId });
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });
  
  // Update consent status - requires audit log entry for GDPR compliance
  app.patch("/api/recall/import/:importId/consent", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { preConsentEmailId, userConfirmsVerbalConsent } = req.body;
      // SECURITY: Don't accept a direct "confirmed" flag - require evidence
      
      const importData = await storage.getMeetingImport(req.params.importId);
      if (!importData || importData.userId !== userId) {
        return res.status(404).json({ message: "Import not found" });
      }
      
      let consentConfirmed = false;
      let consentSource = '';
      
      // Option 1: Verify pre-consent email was acknowledged
      if (preConsentEmailId) {
        const consentEmail = await storage.getPreConsentEmail(preConsentEmailId);
        if (consentEmail && consentEmail.consentAcknowledged && consentEmail.userId === userId) {
          consentConfirmed = true;
          consentSource = 'pre_consent_email';
        } else {
          return res.status(400).json({ 
            message: "Pre-consent email has not been acknowledged by the participant" 
          });
        }
      }
      // Option 2: User attests that verbal consent was obtained during the call
      // This creates an audit trail of the user's attestation for GDPR compliance
      else if (userConfirmsVerbalConsent === true) {
        consentConfirmed = true;
        consentSource = 'user_verbal_attestation';
        
        // Create audit log of the user's attestation
        await storage.createAuditLog({
          eventType: 'consent_attestation',
          userId,
          caseId: importData.caseId || undefined,
          metadata: {
            importId: importData.id,
            attestationType: 'verbal_consent_obtained',
            attestedAt: new Date().toISOString(),
            meetingPlatform: importData.meetingPlatform,
          },
          severity: 'info',
        });
      }
      
      if (!consentConfirmed) {
        return res.status(400).json({ 
          message: "Consent verification required. Provide preConsentEmailId or userConfirmsVerbalConsent." 
        });
      }
      
      await storage.updateMeetingImport(importData.id, { 
        consentConfirmed: true,
        preConsentEmailId: preConsentEmailId || undefined,
      });
      
      res.json({ success: true, consentSource });
    } catch (error) {
      next(error);
    }
  });
  
  // Pre-consent email routes
  app.post("/api/pre-consent", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { 
        recipientEmail, 
        recipientName, 
        meetingPlatform, 
        scheduledMeetingTime, 
        meetingUrl,
        caseId 
      } = req.body;
      
      if (!recipientEmail || !recipientName) {
        return res.status(400).json({ message: "Recipient email and name are required" });
      }
      
      // Generate consent token
      const consentToken = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      
      // Get firm profile for email branding
      const firmProfile = await storage.getFirmProfile();
      const firmName = firmProfile?.firmName || 'LegalNote AI';
      
      // Create email content
      const emailSubject = `Recording Consent for Video Meeting - ${firmName}`;
      const emailBody = `Dear ${recipientName},

We are writing to inform you that we would like to record our upcoming video meeting for the purposes of creating accurate attendance notes and legal documentation.

Meeting Details:
${scheduledMeetingTime ? `- Scheduled Time: ${new Date(scheduledMeetingTime).toLocaleString('en-GB')}` : ''}
${meetingPlatform ? `- Platform: ${meetingPlatform.charAt(0).toUpperCase() + meetingPlatform.slice(1)}` : ''}
${meetingUrl ? `- Meeting Link: ${meetingUrl}` : ''}

By acknowledging this consent, you agree to the recording being used to generate accurate meeting notes and documentation. The recording will be:
- Stored securely with encryption
- Retained for a maximum of 7 days
- Used solely for the purpose of creating legal documentation
- Processed in compliance with GDPR and data protection requirements

Please click the button below to acknowledge your consent:

[Acknowledge Consent Button]

If you have any questions or concerns, please contact us before the meeting.

Kind regards,
${firmName}`;

      // Create consent email record
      const consentEmail = await storage.createPreConsentEmail({
        userId,
        caseId: caseId || undefined,
        recipientEmail,
        recipientName,
        meetingPlatform: meetingPlatform || undefined,
        scheduledMeetingTime: scheduledMeetingTime ? new Date(scheduledMeetingTime) : undefined,
        meetingUrl: meetingUrl || undefined,
        emailSubject,
        emailBody,
        consentToken,
        emailStatus: 'pending',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });
      
      // Send email using Resend
      try {
        const resend = await import("resend");
        const resendClient = new resend.Resend(process.env.RESEND_API_KEY);
        
        const baseUrl = `${req.protocol}://${req.headers.host}`;
        const consentUrl = `${baseUrl}/consent/${consentToken}`;
        
        const htmlBody = emailBody
          .replace(/\n/g, '<br>')
          .replace('[Acknowledge Consent Button]', 
            `<a href="${consentUrl}" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 16px 0;">Acknowledge Consent</a>`
          );
        
        await resendClient.emails.send({
          from: `${firmName} <noreply@${process.env.RESEND_DOMAIN || 'resend.dev'}>`,
          to: recipientEmail,
          subject: emailSubject,
          html: htmlBody,
        });
        
        await storage.updatePreConsentEmail(consentEmail.id, { 
          emailStatus: 'sent',
          emailSentAt: new Date(),
        });
        
        await storage.createAuditLog({
          eventType: 'pre_consent_email_sent',
          userId,
          caseId: caseId || undefined,
          metadata: { 
            recipientEmail, 
            recipientName,
            meetingPlatform,
            consentEmailId: consentEmail.id,
          },
          severity: 'info',
        });
      } catch (emailError: any) {
        console.error('Failed to send pre-consent email:', emailError);
        await storage.updatePreConsentEmail(consentEmail.id, { 
          emailStatus: 'failed',
        });
        return res.status(500).json({ 
          message: "Failed to send consent email",
          error: emailError.message 
        });
      }
      
      res.json({ 
        success: true, 
        consentEmailId: consentEmail.id,
        message: "Consent email sent successfully" 
      });
    } catch (error) {
      next(error);
    }
  });
  
  // Get pre-consent emails for user
  app.get("/api/pre-consent", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const emails = await storage.getPreConsentEmailsByUser(userId);
      res.json(emails);
    } catch (error) {
      next(error);
    }
  });
  
  // Public endpoint for acknowledging consent (no auth required)
  app.post("/api/pre-consent/acknowledge/:token", async (req, res, next) => {
    try {
      const { token } = req.params;
      
      const consentEmail = await storage.getPreConsentEmailByToken(token);
      if (!consentEmail) {
        return res.status(404).json({ message: "Consent request not found" });
      }
      
      // Check if already acknowledged
      if (consentEmail.consentAcknowledged) {
        return res.json({ 
          success: true, 
          alreadyAcknowledged: true,
          message: "Consent was already acknowledged" 
        });
      }
      
      // Check if expired
      if (consentEmail.expiresAt && new Date(consentEmail.expiresAt) < new Date()) {
        return res.status(400).json({ message: "Consent request has expired" });
      }
      
      // Get IP address
      const ipAddress = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';
      
      // Acknowledge consent
      await storage.acknowledgePreConsentEmail(consentEmail.id, ipAddress);
      
      // Update any linked scheduled meeting's consent status
      const meetings = await storage.getScheduledMeetingsByUser(consentEmail.userId);
      const linkedMeeting = meetings.find(m => m.preConsentEmailId === consentEmail.id);
      if (linkedMeeting) {
        await storage.updateScheduledMeeting(linkedMeeting.id, { consentStatus: 'approved' });
      }
      
      await storage.createAuditLog({
        eventType: 'pre_consent_acknowledged',
        userId: consentEmail.userId,
        caseId: consentEmail.caseId || undefined,
        metadata: { 
          recipientEmail: consentEmail.recipientEmail,
          consentEmailId: consentEmail.id,
          scheduledMeetingId: linkedMeeting?.id,
          ipAddress,
        },
        severity: 'info',
      });
      
      res.json({ 
        success: true, 
        message: "Thank you for acknowledging the recording consent" 
      });
    } catch (error) {
      next(error);
    }
  });
  
  // Get consent acknowledgement page (public)
  app.get("/consent/:token", async (req, res, next) => {
    try {
      const { token } = req.params;
      
      const consentEmail = await storage.getPreConsentEmailByToken(token);
      if (!consentEmail) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head><title>Consent Not Found</title></head>
          <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1>Consent Request Not Found</h1>
            <p>This consent request is invalid or has been removed.</p>
          </body>
          </html>
        `);
      }
      
      if (consentEmail.consentAcknowledged) {
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head><title>Consent Already Acknowledged</title></head>
          <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1>Consent Already Acknowledged</h1>
            <p>Thank you! Your consent was acknowledged on ${new Date(consentEmail.consentAcknowledgedAt!).toLocaleString('en-GB')}.</p>
          </body>
          </html>
        `);
      }
      
      if (consentEmail.expiresAt && new Date(consentEmail.expiresAt) < new Date()) {
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head><title>Consent Expired</title></head>
          <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1>Consent Request Expired</h1>
            <p>This consent request has expired. Please contact your solicitor for a new consent request.</p>
          </body>
          </html>
        `);
      }
      
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Recording Consent</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
            h1 { color: #1a1a1a; }
            .card { background: #f8f9fa; border-radius: 8px; padding: 24px; margin: 24px 0; }
            .button { display: inline-block; background: #000; color: #fff; padding: 14px 28px; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; text-decoration: none; }
            .button:hover { background: #333; }
            .success { display: none; color: #059669; }
            .error { display: none; color: #dc2626; }
          </style>
        </head>
        <body>
          <h1>Recording Consent</h1>
          <div class="card">
            <h2>Meeting Recording Consent</h2>
            <p>Dear ${consentEmail.recipientName},</p>
            <p>By clicking "Acknowledge Consent" below, you agree to the recording of your video meeting for the purpose of creating accurate legal documentation.</p>
            <p><strong>Your consent confirms:</strong></p>
            <ul>
              <li>The meeting may be recorded</li>
              <li>The recording will be used to generate attendance notes</li>
              <li>The recording will be stored securely and deleted within 7 days</li>
              <li>Processing complies with GDPR and data protection requirements</li>
            </ul>
          </div>
          <button class="button" onclick="acknowledgeConsent()">Acknowledge Consent</button>
          <p class="success" id="success">Thank you! Your consent has been recorded.</p>
          <p class="error" id="error">Something went wrong. Please try again.</p>
          <script>
            async function acknowledgeConsent() {
              try {
                const response = await fetch('/api/pre-consent/acknowledge/${token}', { method: 'POST' });
                if (response.ok) {
                  document.getElementById('success').style.display = 'block';
                  document.querySelector('.button').style.display = 'none';
                } else {
                  document.getElementById('error').style.display = 'block';
                }
              } catch (e) {
                document.getElementById('error').style.display = 'block';
              }
            }
          </script>
        </body>
        </html>
      `);
    } catch (error) {
      next(error);
    }
  });

  // ==================== SCHEDULED MEETINGS API ====================
  
  // Get upcoming scheduled meetings (next 7 days)
  app.get("/api/scheduled-meetings", isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const daysAhead = parseInt(req.query.daysAhead as string) || 7;
      
      const meetings = await storage.getUpcomingScheduledMeetings(userId, daysAhead);
      res.json(meetings);
    } catch (error) {
      next(error);
    }
  });
  
  // Poll calendar and sync meetings
  app.post("/api/scheduled-meetings/sync", isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      
      const { meetingSchedulerService } = await import("./services/meetingSchedulerService");
      const meetings = await meetingSchedulerService.pollCalendarMeetings(userId);
      
      await storage.createAuditLog({
        eventType: 'calendar_synced',
        userId,
        metadata: { meetingsCount: meetings.length },
        severity: 'info',
      });
      
      res.json({ success: true, meetings });
    } catch (error: any) {
      console.error('[SCHEDULED_MEETINGS] Error syncing calendar:', error);
      
      if (error.message?.includes('not connected')) {
        return res.status(400).json({ 
          message: "Google Calendar not connected. Please connect your calendar in Settings.",
          needsCalendarConnection: true,
        });
      }
      
      next(error);
    }
  });
  
  // Update scheduled meeting (enable/disable auto-record, set client info)
  app.patch("/api/scheduled-meetings/:id", isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { autoRecordEnabled, clientEmail, clientName } = req.body;
      
      const meeting = await storage.getScheduledMeeting(id);
      if (!meeting || meeting.userId !== userId) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      
      const updates: any = {};
      if (autoRecordEnabled !== undefined) updates.autoRecordEnabled = autoRecordEnabled;
      if (clientEmail !== undefined) updates.clientEmail = clientEmail;
      if (clientName !== undefined) updates.clientName = clientName;
      
      const updated = await storage.updateScheduledMeeting(id, updates);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });
  
  // Manually trigger consent email for a meeting
  app.post("/api/scheduled-meetings/:id/send-consent", isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      const meeting = await storage.getScheduledMeeting(id);
      if (!meeting || meeting.userId !== userId) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      
      if (!meeting.clientEmail) {
        return res.status(400).json({ message: "No client email set for this meeting" });
      }
      
      const { meetingSchedulerService } = await import("./services/meetingSchedulerService");
      const success = await meetingSchedulerService.sendConsentEmailForMeeting(meeting);
      
      if (success) {
        await storage.createAuditLog({
          eventType: 'pre_consent_email_sent',
          userId,
          metadata: { 
            meetingId: meeting.id,
            recipientEmail: meeting.clientEmail,
          },
          severity: 'info',
        });
        
        res.json({ success: true, message: "Consent email sent" });
      } else {
        res.status(500).json({ success: false, message: "Failed to send consent email" });
      }
    } catch (error) {
      next(error);
    }
  });
  
  // Manually deploy bot for a meeting
  app.post("/api/scheduled-meetings/:id/deploy-bot", isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      const meeting = await storage.getScheduledMeeting(id);
      if (!meeting || meeting.userId !== userId) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      
      if (!meeting.meetingUrl) {
        return res.status(400).json({ message: "No meeting URL detected for this meeting" });
      }
      
      if (meeting.consentStatus !== 'approved') {
        return res.status(400).json({ message: "Client consent not yet approved" });
      }
      
      const { meetingSchedulerService } = await import("./services/meetingSchedulerService");
      const success = await meetingSchedulerService.deployBotForMeeting(meeting);
      
      if (success) {
        res.json({ success: true, message: "Bot deployed" });
      } else {
        res.status(500).json({ success: false, message: "Failed to deploy bot" });
      }
    } catch (error) {
      next(error);
    }
  });
  
  // Set meeting URL manually (for meetings without detected URL)
  app.post("/api/scheduled-meetings/:id/set-url", isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { meetingUrl } = req.body;
      
      if (!meetingUrl) {
        return res.status(400).json({ message: "Meeting URL is required" });
      }
      
      const meeting = await storage.getScheduledMeeting(id);
      if (!meeting || meeting.userId !== userId) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      
      // Detect platform from URL
      let meetingPlatform: string | undefined;
      const urlLower = meetingUrl.toLowerCase();
      if (urlLower.includes('zoom.us')) meetingPlatform = 'zoom';
      else if (urlLower.includes('teams.microsoft.com') || urlLower.includes('teams.live.com')) meetingPlatform = 'teams';
      else if (urlLower.includes('meet.google.com')) meetingPlatform = 'meet';
      else if (urlLower.includes('webex.com')) meetingPlatform = 'webex';
      
      const updated = await storage.updateScheduledMeeting(id, { 
        meetingUrl,
        meetingPlatform: meetingPlatform || null,
      });
      
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // ============================
  // CLIO INTEGRATION ROUTES
  // ============================

  // Get Clio connection status
  app.get("/api/clio/status", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { clioService } = await import("./clio");

      if (!clioService.isConfigured()) {
        return res.json({
          configured: false,
          connected: false,
          message: "Clio integration not configured. Add CLIO_CLIENT_ID and CLIO_CLIENT_SECRET to connect.",
        });
      }

      const connection = await clioService.getConnection(userId);

      if (!connection) {
        return res.json({
          configured: true,
          connected: false,
        });
      }

      res.json({
        configured: true,
        connected: connection.status === "active",
        status: connection.status,
        firmName: connection.clioFirmName,
        email: connection.clioUserEmail,
        lastSyncAt: connection.lastSyncAt,
        syncEnabled: connection.syncEnabled,
      });
    } catch (error) {
      next(error);
    }
  });

  // Initiate Clio OAuth flow
  app.get("/api/clio/auth", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { clioService } = await import("./clio");

      if (!clioService.isConfigured()) {
        return res.status(503).json({
          message: "Clio integration not configured. Please contact your administrator.",
        });
      }

      const statePayload: OAuthStatePayload = {
        userId,
        provider: 'clio',
        popup: false,
        nonce: generateSecureNonce(),
        createdAt: Date.now(),
      };

      const signedState = signOAuthState(statePayload);
      const authUrl = clioService.getAuthorizationUrl(signedState);

      res.redirect(authUrl);
    } catch (error) {
      next(error);
    }
  });

  // Clio OAuth callback
  app.get("/api/clio/callback", async (req: any, res, next) => {
    try {
      const { code, state, error: oauthError } = req.query;

      if (oauthError) {
        console.error("[Clio] OAuth error:", oauthError);
        return res.redirect("/settings?clio_error=" + encodeURIComponent(String(oauthError)));
      }

      if (!code || !state) {
        return res.redirect("/settings?clio_error=missing_code_or_state");
      }

      const stateData = verifyOAuthState(state as string);
      
      if (!stateData || stateData.provider !== 'clio') {
        return res.redirect("/settings?clio_error=invalid_state");
      }

      const { clioService } = await import("./clio");

      try {
        const tokens = await clioService.exchangeCodeForTokens(code as string);
        const userInfo = await clioService.getCurrentUser(tokens.access_token);

        await clioService.saveConnection(stateData.userId, tokens, userInfo);

        await storage.createAuditLog({
          eventType: 'clio_connected',
          userId: stateData.userId,
          metadata: {
            firmName: userInfo.firm.name,
            clioUserId: userInfo.user.id,
          },
          severity: 'info',
        });

        res.redirect("/settings?clio_connected=true");
      } catch (exchangeError: any) {
        console.error("[Clio] Token exchange error:", exchangeError);
        res.redirect("/settings?clio_error=" + encodeURIComponent("Failed to connect to Clio"));
      }
    } catch (error) {
      next(error);
    }
  });

  // Disconnect Clio
  app.post("/api/clio/disconnect", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { clioService } = await import("./clio");

      await clioService.disconnectUser(userId);

      await storage.createAuditLog({
        eventType: 'clio_disconnected',
        userId,
        metadata: {},
        severity: 'info',
      });

      res.json({ success: true, message: "Disconnected from Clio" });
    } catch (error) {
      next(error);
    }
  });

  // Get Clio matters list
  app.get("/api/clio/matters", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { status, search, limit, offset } = req.query;
      const { clioService } = await import("./clio");

      const accessToken = await clioService.ensureValidToken(userId);
      
      if (!accessToken) {
        return res.status(401).json({
          message: "Clio connection expired. Please reconnect.",
          requiresReconnect: true,
        });
      }

      const matters = await clioService.getMatters(accessToken, {
        status: status as string,
        search: search as string,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      });

      res.json(matters);
    } catch (error: any) {
      if (error.message === "CLIO_TOKEN_EXPIRED") {
        return res.status(401).json({
          message: "Clio connection expired. Please reconnect.",
          requiresReconnect: true,
        });
      }
      next(error);
    }
  });

  // Import a Clio matter as a new case
  app.post("/api/clio/matters/:matterId/import", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { matterId } = req.params;
      const { clioService } = await import("./clio");

      const accessToken = await clioService.ensureValidToken(userId);
      
      if (!accessToken) {
        return res.status(401).json({
          message: "Clio connection expired. Please reconnect.",
          requiresReconnect: true,
        });
      }

      const matter = await clioService.getMatter(accessToken, matterId);
      const caseId = await clioService.importMatterAsCase(userId, matter);

      await storage.createAuditLog({
        eventType: 'clio_matter_imported',
        userId,
        caseId,
        metadata: {
          clioMatterId: matterId,
          clioMatterNumber: matter.display_number,
          clientName: matter.client?.name,
        },
        severity: 'info',
      });

      res.json({
        success: true,
        caseId,
        message: `Imported matter "${matter.display_number}" as case`,
      });
    } catch (error: any) {
      if (error.message === "CLIO_TOKEN_EXPIRED") {
        return res.status(401).json({
          message: "Clio connection expired. Please reconnect.",
          requiresReconnect: true,
        });
      }
      next(error);
    }
  });

  // Link an existing case to a Clio matter
  app.post("/api/cases/:caseId/link-clio", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId } = req.params;
      const { matterId } = req.body;
      const { clioService } = await import("./clio");

      const caseData = await storage.getCase(caseId);
      if (!caseData || caseData.createdBy !== userId) {
        return res.status(404).json({ message: "Case not found" });
      }

      const accessToken = await clioService.ensureValidToken(userId);
      
      if (!accessToken) {
        return res.status(401).json({
          message: "Clio connection expired. Please reconnect.",
          requiresReconnect: true,
        });
      }

      const matter = await clioService.getMatter(accessToken, matterId);
      await clioService.linkMatterToCase(userId, caseId, matter);

      await storage.createAuditLog({
        eventType: 'clio_matter_linked',
        userId,
        caseId,
        metadata: {
          clioMatterId: matterId,
          clioMatterNumber: matter.display_number,
        },
        severity: 'info',
      });

      res.json({
        success: true,
        message: `Linked case to Clio matter "${matter.display_number}"`,
      });
    } catch (error: any) {
      if (error.message === "CLIO_TOKEN_EXPIRED") {
        return res.status(401).json({
          message: "Clio connection expired. Please reconnect.",
          requiresReconnect: true,
        });
      }
      next(error);
    }
  });

  // Unlink a case from Clio
  app.delete("/api/cases/:caseId/link-clio", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId } = req.params;
      const { clioService } = await import("./clio");

      const caseData = await storage.getCase(caseId);
      if (!caseData || caseData.createdBy !== userId) {
        return res.status(404).json({ message: "Case not found" });
      }

      await clioService.unlinkCase(caseId);

      await storage.createAuditLog({
        eventType: 'clio_matter_unlinked',
        userId,
        caseId,
        metadata: {},
        severity: 'info',
      });

      res.json({ success: true, message: "Unlinked case from Clio" });
    } catch (error) {
      next(error);
    }
  });

  // Get linked Clio matters for user
  app.get("/api/clio/links", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { clioService } = await import("./clio");

      const links = await clioService.getMatterLinks(userId);
      res.json(links);
    } catch (error) {
      next(error);
    }
  });

  // ============================
  // SHAREPOINT/ONEDRIVE INTEGRATION ROUTES
  // ============================

  // Get SharePoint/OneDrive connection status
  app.get("/api/storage/status", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { isStorageConnected, getStorageInfo } = await import("./sharepoint");
      
      const [sharePointConnected, oneDriveConnected] = await Promise.all([
        isStorageConnected('sharepoint'),
        isStorageConnected('onedrive'),
      ]);
      
      const connections = await storage.getUserSharePointConnections(userId);
      const sharePointConnection = connections.find(c => c.provider === 'sharepoint');
      const oneDriveConnection = connections.find(c => c.provider === 'onedrive');
      
      const result: any = {
        sharepoint: {
          available: sharePointConnected,
          connected: !!sharePointConnection,
          autoSyncEnabled: sharePointConnection?.autoSyncEnabled ?? false,
          email: sharePointConnection?.email || null,
          driveName: sharePointConnection?.driveName || null,
        },
        onedrive: {
          available: oneDriveConnected,
          connected: !!oneDriveConnection,
          autoSyncEnabled: oneDriveConnection?.autoSyncEnabled ?? false,
          email: oneDriveConnection?.email || null,
          driveName: oneDriveConnection?.driveName || null,
        },
      };
      
      // Get additional info if Replit connectors are available
      if (sharePointConnected && !sharePointConnection) {
        try {
          const info = await getStorageInfo('sharepoint');
          result.sharepoint.availableInfo = {
            email: info.email,
            drive: info.drive,
            sites: info.sites,
          };
        } catch {}
      }
      
      if (oneDriveConnected && !oneDriveConnection) {
        try {
          const info = await getStorageInfo('onedrive');
          result.onedrive.availableInfo = {
            email: info.email,
            drive: info.drive,
          };
        } catch {}
      }
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // Connect SharePoint/OneDrive (save connection after Replit connector auth)
  app.post("/api/storage/connect", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { provider, driveId, siteId } = req.body;
      
      if (!provider || !['sharepoint', 'onedrive'].includes(provider)) {
        return res.status(400).json({ message: "Invalid provider. Use 'sharepoint' or 'onedrive'" });
      }
      
      const { isStorageConnected, getStorageInfo, ensureLegalNoteFolderStructure, getSiteDrives } = await import("./sharepoint");
      
      // Check if Replit connector is available
      const connectorAvailable = await isStorageConnected(provider);
      if (!connectorAvailable) {
        return res.status(400).json({ 
          message: `${provider === 'sharepoint' ? 'SharePoint' : 'OneDrive'} connector not set up. Please connect via Replit Tools first.` 
        });
      }
      
      // Get connection info
      const info = await getStorageInfo(provider);
      
      let targetDriveId = driveId;
      let targetDriveName = info.drive?.name || null;
      
      // For SharePoint, user can specify a site and drive
      if (provider === 'sharepoint' && siteId) {
        const siteDrives = await getSiteDrives(siteId);
        if (siteDrives.length > 0) {
          targetDriveId = siteDrives[0].id;
          targetDriveName = siteDrives[0].name;
        }
      } else if (!targetDriveId && info.drive) {
        targetDriveId = info.drive.id;
      }
      
      if (!targetDriveId) {
        return res.status(400).json({ message: "No drive found. Please select a drive." });
      }
      
      // Create folder structure
      const folders = await ensureLegalNoteFolderStructure(provider, targetDriveId);
      if (!folders.rootFolder) {
        return res.status(500).json({ message: "Failed to create LegalNote folder structure" });
      }
      
      // Save connection
      const connection = await storage.saveSharePointConnection({
        userId,
        provider,
        driveId: targetDriveId,
        driveName: targetDriveName,
        email: info.email,
        status: 'active',
        autoSyncEnabled: true,
      });
      
      await storage.createAuditLog({
        eventType: `${provider}_connected`,
        userId,
        metadata: {
          driveId: targetDriveId,
          driveName: targetDriveName,
          email: info.email,
        },
        severity: 'info',
      });
      
      res.json({
        success: true,
        connection: {
          provider: connection.provider,
          driveId: connection.driveId,
          driveName: connection.driveName,
          email: connection.email,
          autoSyncEnabled: connection.autoSyncEnabled,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // Disconnect SharePoint/OneDrive
  app.delete("/api/storage/disconnect/:provider", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { provider } = req.params;
      
      if (!['sharepoint', 'onedrive'].includes(provider)) {
        return res.status(400).json({ message: "Invalid provider" });
      }
      
      await storage.deleteSharePointConnection(userId, provider as 'sharepoint' | 'onedrive');
      
      await storage.createAuditLog({
        eventType: `${provider}_disconnected`,
        userId,
        metadata: {},
        severity: 'info',
      });
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Update auto-sync setting
  app.patch("/api/storage/:provider/settings", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { provider } = req.params;
      const { autoSyncEnabled } = req.body;
      
      if (!['sharepoint', 'onedrive'].includes(provider)) {
        return res.status(400).json({ message: "Invalid provider" });
      }
      
      const connection = await storage.getSharePointConnection(userId, provider as 'sharepoint' | 'onedrive');
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }
      
      const updated = await storage.updateSharePointConnection(
        userId, 
        provider as 'sharepoint' | 'onedrive',
        { autoSyncEnabled }
      );
      
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // Sync a document to storage
  app.post("/api/storage/sync-document", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { provider, documentId, caseId } = req.body;
      
      if (!provider || !['sharepoint', 'onedrive'].includes(provider)) {
        return res.status(400).json({ message: "Invalid provider" });
      }
      
      if (!documentId || !caseId) {
        return res.status(400).json({ message: "documentId and caseId are required" });
      }
      
      const connection = await storage.getSharePointConnection(userId, provider as 'sharepoint' | 'onedrive');
      if (!connection) {
        return res.status(400).json({ message: `Not connected to ${provider}` });
      }
      
      // Get document and case
      const document = await storage.getDocument(documentId);
      const caseData = await storage.getCase(caseId, userId);
      
      if (!document || !caseData) {
        return res.status(404).json({ message: "Document or case not found" });
      }
      
      const { syncDocumentToStorage } = await import("./sharepoint");
      
      // Determine file name and content
      const ext = document.format === 'docx' ? '.docx' : '.pdf';
      const fileName = `${document.title || document.type}${ext}`;
      const content = document.content || '';
      const mimeType = document.format === 'docx' 
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf';
      
      const uploaded = await syncDocumentToStorage(
        provider as 'sharepoint' | 'onedrive',
        connection.driveId,
        caseData.title,
        caseData.clientName,
        document.type,
        fileName,
        Buffer.from(content),
        mimeType
      );
      
      if (!uploaded) {
        return res.status(500).json({ message: "Failed to sync document" });
      }
      
      await storage.createAuditLog({
        eventType: 'document_synced_to_storage',
        userId,
        caseId,
        metadata: {
          provider,
          documentId,
          fileName,
          webUrl: uploaded.webUrl,
        },
        severity: 'info',
      });
      
      res.json({
        success: true,
        file: uploaded,
      });
    } catch (error) {
      next(error);
    }
  });

  // List SharePoint sites (for site selection UI)
  app.get("/api/storage/sharepoint/sites", isAuthenticated, async (req: any, res, next) => {
    try {
      const { isStorageConnected, getSharePointSites } = await import("./sharepoint");
      
      const connected = await isStorageConnected('sharepoint');
      if (!connected) {
        return res.status(400).json({ message: "SharePoint connector not set up" });
      }
      
      const sites = await getSharePointSites();
      res.json(sites);
    } catch (error) {
      next(error);
    }
  });

  // Get drives for a SharePoint site
  app.get("/api/storage/sharepoint/sites/:siteId/drives", isAuthenticated, async (req: any, res, next) => {
    try {
      const { siteId } = req.params;
      const { isStorageConnected, getSiteDrives } = await import("./sharepoint");
      
      const connected = await isStorageConnected('sharepoint');
      if (!connected) {
        return res.status(400).json({ message: "SharePoint connector not set up" });
      }
      
      const drives = await getSiteDrives(siteId);
      res.json(drives);
    } catch (error) {
      next(error);
    }
  });

  // DEMO DATA ENDPOINTS
  
  // Seed demo data for demonstrations
  app.post("/api/demo/seed", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { seedDemoData } = await import("./services/demoSeedService");
      const result = await seedDemoData(userId);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      console.error('[DEMO] Error seeding demo data:', error);
      res.status(500).json({ 
        success: false,
        message: "Failed to seed demo data",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Reset demo data (clear and re-seed)
  app.post("/api/demo/reset", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { resetDemoData } = await import("./services/demoSeedService");
      const result = await resetDemoData(userId);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      console.error('[DEMO] Error resetting demo data:', error);
      res.status(500).json({ 
        success: false,
        message: "Failed to reset demo data",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Clear demo data
  app.delete("/api/demo/clear", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { clearDemoData } = await import("./services/demoSeedService");
      const result = await clearDemoData(userId);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      console.error('[DEMO] Error clearing demo data:', error);
      res.status(500).json({ 
        success: false,
        message: "Failed to clear demo data",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // TEST ENDPOINT: Trigger audio cleanup (development only)
  app.post("/api/test/trigger-audio-cleanup", async (req, res, next) => {
    try {
      // Security: Only allow in development mode
      if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({ 
          message: "This endpoint is only available in development mode" 
        });
      }

      const { cleanupExpiredAudio } = await import("./audioCleanup");
      await cleanupExpiredAudio();

      res.json({ 
        success: true, 
        message: "Audio cleanup completed successfully",
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[TEST] Error triggering cleanup:', error);
      res.status(500).json({ 
        success: false,
        message: "Failed to trigger audio cleanup",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Global action items (all cases for the user)
  app.get("/api/action-items/all", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const items = await storage.getAllActionItemsForUser(userId);
      res.json(items);
    } catch (error: any) {
      next(error);
    }
  });

  // In-app notifications system (simple polling + SSE)
  // Notifications are generated from audit trail events
  app.get("/api/notifications", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      
      // Generate notifications from recent audit trail events
      const { db: dbConn } = await import("./db");
      const { auditTrail, cases: casesTable } = await import("@shared/schema");
      const { eq, and, desc, gte, inArray: inArr } = await import("drizzle-orm");
      
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // last 7 days
      
      const notifiableEvents = [
        'transcript_generated', 'document_generated', 'document_regenerated',
        'case_email_sent', 'audio_expiring_soon', 'deadline_approaching', 'consent_given'
      ];
      
      const events = await dbConn
        .select()
        .from(auditTrail)
        .where(
          and(
            eq(auditTrail.userId, userId),
            gte(auditTrail.timestamp, since),
            inArr(auditTrail.eventType, notifiableEvents)
          )
        )
        .orderBy(desc(auditTrail.timestamp))
        .limit(30);
      
      // Get case titles for events that have caseIds
      const caseIds = [...new Set(events.filter(e => e.caseId).map(e => e.caseId as string))];
      let caseMap: Map<string, any> = new Map();
      if (caseIds.length > 0) {
        const caseRecords = await dbConn.select().from(casesTable).where(inArr(casesTable.id, caseIds));
        caseMap = new Map(caseRecords.map(c => [c.id, c]));
      }
      
      // Get user's read notifications from user preferences metadata (stored in audit trail metadata)
      const readNotifications = new Set<string>();
      const readEvents = await dbConn
        .select()
        .from(auditTrail)
        .where(
          and(
            eq(auditTrail.userId, userId),
            eq(auditTrail.eventType, 'notification_read')
          )
        );
      readEvents.forEach(e => {
        const meta = e.metadata as any;
        if (meta?.notificationId) readNotifications.add(meta.notificationId);
      });
      
      const notifications = events.map(event => {
        const caseRecord = event.caseId ? caseMap.get(event.caseId) : null;
        let title = '';
        let message = '';
        
        switch (event.eventType) {
          case 'transcript_generated':
            title = 'Transcription Complete';
            message = `The transcript for ${caseRecord?.title || 'your case'} is ready to review.`;
            break;
          case 'document_generated':
            title = 'Document Ready';
            message = `Attendance note and summary for ${caseRecord?.title || 'your case'} have been generated.`;
            break;
          case 'document_regenerated':
            title = 'Document Regenerated';
            message = `Documents for ${caseRecord?.title || 'your case'} have been updated.`;
            break;
          case 'case_email_sent':
            title = 'Email Sent';
            message = `Documents for ${caseRecord?.title || 'your case'} were sent to the client.`;
            break;
          case 'consent_given':
            title = 'Consent Confirmed';
            message = `Client consent was confirmed for ${caseRecord?.title || 'your case'}.`;
            break;
          case 'audio_expiring_soon':
            title = 'Audio Expiring Soon';
            message = `Recording for ${caseRecord?.title || 'a case'} will be auto-deleted within 24 hours (GDPR retention).`;
            break;
          case 'deadline_approaching':
            title = 'Deadline Approaching';
            message = `Case deadline for ${caseRecord?.title || 'a case'} is approaching.`;
            break;
          default:
            title = event.eventType.replace(/_/g, ' ');
            message = '';
        }
        
        return {
          id: event.id,
          type: event.eventType,
          title,
          message,
          caseId: event.caseId || undefined,
          caseTitle: caseRecord?.title,
          createdAt: event.timestamp.toISOString(),
          readAt: readNotifications.has(event.id) ? event.timestamp.toISOString() : undefined,
        };
      }).filter(n => n.title);
      
      res.json(notifications);
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/notifications/:id/read", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      await logAuditEvent(userId, "notification_read", {
        metadata: { notificationId: id },
        req,
      });
      res.json({ success: true });
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/notifications/mark-all-read", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      await logAuditEvent(userId, "notification_read", {
        metadata: { markAllRead: true, timestamp: new Date().toISOString() },
        req,
      });
      res.json({ success: true });
    } catch (error: any) {
      next(error);
    }
  });

  // SSE stream for real-time notifications
  const sseClients = new Map<string, Set<Response>>();
  
  app.get("/api/notifications/stream", isAuthenticated, (req: any, res: any) => {
    const userId = req.user.claims.sub;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
    
    if (!sseClients.has(userId)) sseClients.set(userId, new Set());
    sseClients.get(userId)!.add(res);
    
    const heartbeat = setInterval(() => {
      res.write(':heartbeat\n\n');
    }, 30000);
    
    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.get(userId)?.delete(res);
    });
  });

  const httpServer = createServer(app);

  return httpServer;
}
