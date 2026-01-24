import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Scale, FileText, ShieldCheck, Clock, Calendar, Check, Building2, User, ArrowRight, Mail, Linkedin, CheckCircle2, XCircle, FileCheck, ClipboardCheck, Users, Gavel, Mic, FileOutput, Brain, Info, Menu, X, ChevronLeft, ChevronRight, FileQuestion, AlertTriangle, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { motion, useScroll, useTransform, useInView, AnimatePresence } from "framer-motion";
import Logo from "@/components/Logo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EarlyAccessForm } from "@/components/EarlyAccessForm";
import { WorkflowInfographic } from "@/components/WorkflowInfographic";
import { ExploreModal, useExploreModal } from "@/components/ExploreModal";
import heroSolicitorImage from "@assets/openart-subject-female-professional-early-40s-british-exotic-l_1769257060192.jpg";

const isPreviewMode = import.meta.env.VITE_PREVIEW_MODE === 'true';

// Animated counter hook
function useCounter(end: number, duration: number = 2000, startOnView: boolean = true) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (startOnView && !isInView) return;
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    let startTime: number;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * end));
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };
    requestAnimationFrame(animate);
  }, [end, duration, isInView, startOnView]);

  return { count, ref };
}

// Typewriter effect component
function TypewriterText({ texts, className }: { texts: string[]; className?: string }) {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentFullText = texts[currentTextIndex];
    const typeSpeed = isDeleting ? 30 : 50;
    
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        if (displayText.length < currentFullText.length) {
          setDisplayText(currentFullText.slice(0, displayText.length + 1));
        } else {
          setTimeout(() => setIsDeleting(true), 2000);
        }
      } else {
        if (displayText.length > 0) {
          setDisplayText(displayText.slice(0, -1));
        } else {
          setIsDeleting(false);
          setCurrentTextIndex((prev) => (prev + 1) % texts.length);
        }
      }
    }, typeSpeed);

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, currentTextIndex, texts]);

  return (
    <span className={className}>
      {displayText}
      <span className="animate-pulse">|</span>
    </span>
  );
}

// Check for reduced motion preference
function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };
    
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
  
  return prefersReducedMotion;
}

// Scroll progress indicator
function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  
  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-1 bg-[hsl(18,70%,42%)] origin-left z-[100]"
      style={{ scaleX: scrollYProgress }}
    />
  );
}

// 3D Tilt card wrapper
function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateXVal = ((y - centerY) / centerY) * -5;
    const rotateYVal = ((x - centerX) / centerX) * 5;
    setRotateX(rotateXVal);
    setRotateY(rotateYVal);
  };
  
  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };
  
  return (
    <motion.div
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ rotateX, rotateY }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      style={{ transformStyle: "preserve-3d", perspective: 1000 }}
    >
      {children}
    </motion.div>
  );
}

// Trust logos marquee
function TrustLogosMarquee() {
  const prefersReducedMotion = useReducedMotion();
  const firms = [
    "Family Law",
    "Criminal Defence",
    "Conveyancing",
    "Commercial Litigation",
    "Employment Law",
    "Personal Injury",
    "Private Client",
    "Corporate & M&A",
  ];
  
  return (
    <div className="bg-[hsl(30,20%,96%)] py-6 overflow-hidden border-y border-[hsl(30,15%,90%)]">
      <div className="max-w-7xl mx-auto px-6 mb-4">
        <p className="text-xs text-center text-[hsl(25,15%,55%)] uppercase tracking-wider font-medium">
          Trusted by forward-thinking firms across the UK
        </p>
      </div>
      <div className="relative">
        <motion.div
          className="flex gap-12 whitespace-nowrap"
          animate={prefersReducedMotion ? {} : {
            x: ["0%", "-50%"],
          }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: "loop",
              duration: 25,
              ease: "linear",
            },
          }}
        >
          {[...firms, ...firms, ...firms].map((firm, index) => (
            <div
              key={index}
              className="flex items-center gap-3 px-6 py-2"
            >
              <div className="w-8 h-8 rounded-lg bg-[hsl(25,20%,88%)] flex items-center justify-center">
                <Building2 className="w-4 h-4 text-[hsl(25,25%,45%)]" />
              </div>
              <span className="text-sm font-medium text-[hsl(25,20%,40%)]">{firm}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

// Hero image with parallax effect (respects reduced motion)
function HeroImageParallax() {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });
  const y = useTransform(scrollYProgress, [0, 1], prefersReducedMotion ? [0, 0] : [0, 100]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], prefersReducedMotion ? [1, 1, 1] : [1, 1.05, 1]);
  
  return (
    <div ref={ref} className="relative px-6 mb-12 overflow-hidden">
      <motion.div
        className="max-w-7xl mx-auto"
        initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.6, delay: prefersReducedMotion ? 0 : 0.2 }}
        style={{ y, scale }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Left panel - App preview mockup */}
          <motion.div 
            className="bg-[hsl(25,30%,70%)] rounded-lg sm:rounded-xl p-6 sm:p-8 aspect-[4/3] flex items-center justify-center"
            whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
            transition={{ duration: 0.3 }}
          >
            <div className="bg-white rounded-lg shadow-xl p-4 sm:p-5 w-full max-w-[280px]">
              <div className="text-sm font-medium text-[hsl(25,25%,20%)] mb-3">Record meeting</div>
              <div className="text-xs text-[hsl(25,20%,45%)] mb-4 leading-relaxed">
                Capture attendance notes with<br />consent-first workflows
              </div>
              <div className="bg-[hsl(18,65%,45%)] text-white text-xs py-2 px-4 rounded text-center">
                Start recording
              </div>
            </div>
          </motion.div>
          {/* Right panel - Abstract legal imagery */}
          <motion.div 
            className="bg-[hsl(25,30%,70%)] rounded-lg sm:rounded-xl aspect-[4/3] flex items-center justify-center overflow-hidden"
            whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-[hsl(25,20%,40%)] text-center p-4">
              <Scale className="w-16 h-16 mx-auto mb-2 opacity-50" />
              <span className="text-sm opacity-70">Compliance-first documentation</span>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

// Before/After comparison slider with keyboard accessibility
function ComparisonSlider() {
  const [sliderPosition, setSliderPosition] = useState(15);
  const containerRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(5, Math.min(95, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };
  
  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);
  
  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 5;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      setSliderPosition(prev => Math.max(5, prev - step));
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      setSliderPosition(prev => Math.min(95, prev + step));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSliderPosition(5);
    } else if (e.key === 'End') {
      e.preventDefault();
      setSliderPosition(95);
    }
  };
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) handleMove(e.clientX);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging) handleMove(e.touches[0].clientX);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging]);
  
  return (
    <div className="py-16 bg-white">
      <div className="max-w-4xl mx-auto px-6">
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-sm font-medium text-[hsl(18,65%,45%)] uppercase tracking-wider mb-4 block">
            See the Difference
          </span>
          <h2 className="text-3xl sm:text-4xl font-normal text-[hsl(25,30%,12%)] mb-4" style={{ fontFamily: "'Lora', Georgia, serif" }}>
            From handwritten to evidential
          </h2>
          <p className="text-lg text-[hsl(25,20%,40%)] mb-2">
            This comparison achieved in under 2 minutes after the meeting ends
          </p>
          <p className="text-base text-[hsl(25,15%,50%)]">
            Drag the slider to compare your best effort with LegalNote output
          </p>
        </motion.div>
        
        <motion.div
          ref={containerRef}
          className="relative rounded-2xl overflow-hidden shadow-2xl border border-[hsl(30,20%,85%)] select-none"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          {/* Before - Traditional Notes (Competent Solicitor's Best Effort) */}
          <div className="relative h-[400px] bg-[hsl(40,30%,95%)]">
            <div className="absolute inset-0 p-6 sm:p-8 pl-[12%] sm:pl-[10%]">
              <div className="mb-4">
                <span className="text-xs font-medium text-[hsl(25,40%,45%)] uppercase tracking-wider bg-[hsl(25,30%,90%)] px-3 py-1 rounded-full">
                  Your Best Effort
                </span>
              </div>
              <div 
                className="text-sm sm:text-base text-[hsl(220,10%,25%)] space-y-1.5 leading-relaxed"
                style={{ 
                  fontFamily: "'Caveat', 'Segoe Script', cursive",
                  transform: 'rotate(-0.3deg)'
                }}
              >
                <p className="font-medium" style={{ transform: 'rotate(0.2deg)' }}>Emma Richards - Divorce financial settlement</p>
                <p style={{ transform: 'rotate(-0.2deg)' }}>Family home approx £850k, valued last month</p>
                <p className="ml-1" style={{ transform: 'rotate(0.1deg)' }}>Husband's pension - needs CETV</p>
                <p style={{ transform: 'rotate(-0.3deg)' }}>Client wants to stay in property until kids finish school (6 yrs)</p>
                <p className="ml-2" style={{ transform: 'rotate(0.2deg)' }}>Husband offered to pay school fees - client doesn't trust</p>
                <p style={{ transform: 'rotate(-0.1deg)' }}>Discussed 60/40 split, Form E needed</p>
                <p className="mt-3 text-xs sm:text-sm text-[hsl(25,30%,50%)] italic" style={{ transform: 'rotate(0.2deg)' }}>Good notes. But what exactly did she say about trust?</p>
                <p className="text-xs sm:text-sm text-[hsl(25,30%,50%)] italic" style={{ transform: 'rotate(-0.2deg)' }}>What advice was given about the Mesher order?</p>
                <p className="text-xs sm:text-sm text-[hsl(25,30%,50%)] italic ml-1" style={{ transform: 'rotate(0.1deg)' }}>When disputes arise, will this be enough?</p>
              </div>
            </div>
          </div>
          
          {/* After - LegalNote Output (SRA Structure) */}
          <div 
            className="absolute inset-0 h-[400px] bg-white overflow-hidden"
            style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
          >
            <div className="absolute inset-0 p-4 sm:p-5 pr-[10%] overflow-y-auto">
              <div className="mb-2 flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-[hsl(130,50%,35%)] uppercase tracking-wider bg-[hsl(130,50%,95%)] px-2 py-0.5 rounded-full">
                  LegalNote Output
                </span>
                <Badge className="bg-[hsl(18,70%,42%)] text-white text-[10px]">SRA-Aligned Structure</Badge>
              </div>
              <div className="text-xs text-[hsl(25,25%,20%)] space-y-1.5">
                {/* Header */}
                <div className="border-l-2 border-[hsl(18,60%,50%)] pl-2 pb-1">
                  <p className="font-semibold text-sm text-[hsl(25,30%,15%)]">Attendance Note</p>
                  <p className="text-[10px] text-[hsl(25,15%,50%)]">Richards v Richards | 12 Mar 2025 | 52 mins</p>
                  <p className="text-[10px] text-[hsl(130,50%,40%)]">Consent: Verbal [00:00:22]</p>
                </div>
                
                {/* Instructions Received */}
                <div className="bg-[hsl(30,20%,97%)] rounded p-2">
                  <p className="font-medium text-[hsl(25,30%,25%)] text-[10px] uppercase tracking-wide mb-1">Instructions Received</p>
                  <p className="text-[11px] text-[hsl(25,25%,30%)]">Client instructs to pursue 60/40 asset split. Priority: remain in family home until youngest finishes school (6 years). Concerns re husband's reliability on school fees.</p>
                </div>
                
                {/* Advice Given */}
                <div className="bg-[hsl(18,30%,96%)] rounded p-2 border-l-2 border-[hsl(18,50%,50%)]">
                  <p className="font-medium text-[hsl(25,30%,25%)] text-[10px] uppercase tracking-wide mb-1">Advice Given</p>
                  <p className="text-[11px]">Advised Mesher order may be appropriate. School fees commitment should be documented in consent order with enforcement mechanism. CETV required before pension sharing can be assessed.</p>
                </div>
                
                {/* Actions Required */}
                <div className="bg-[hsl(220,30%,96%)] rounded p-2">
                  <p className="font-medium text-[hsl(25,30%,25%)] text-[10px] uppercase tracking-wide mb-1">Actions Required</p>
                  <p className="text-[10px]">1. Request Form E from husband's solicitor — 19 Mar</p>
                  <p className="text-[10px]">2. Client to obtain pension CETV — 17 Mar</p>
                  <p className="text-[10px]">3. Draft Mesher order terms for review — 21 Mar</p>
                </div>
                
                {/* Client Acknowledgement */}
                <div className="bg-[hsl(130,30%,96%)] rounded p-1.5 text-[10px] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[hsl(130,50%,40%)]" />
                  <span className="text-[hsl(130,40%,30%)]">Client version sent for acknowledgement</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Slider Handle - Accessible */}
          <div 
            ref={sliderRef}
            role="slider"
            aria-label="Comparison slider - drag or use arrow keys to compare traditional notes with LegalNote output"
            aria-valuemin={5}
            aria-valuemax={95}
            aria-valuenow={Math.round(sliderPosition)}
            aria-valuetext={`${Math.round(sliderPosition)}% LegalNote view`}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onMouseDown={handleMouseDown}
            onTouchStart={handleMouseDown}
            className="absolute top-0 bottom-0 w-1 bg-[hsl(18,70%,42%)] cursor-ew-resize z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(18,70%,42%)] focus-visible:ring-offset-2"
            style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-[hsl(18,70%,42%)] shadow-lg flex items-center justify-center touch-none">
              <div className="flex gap-0.5">
                <div className="w-0.5 h-4 bg-white rounded-full" />
                <div className="w-0.5 h-4 bg-white rounded-full" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// Audit Trail comparison slider - Nothing vs Everything documented
function AuditTrailComparisonSlider() {
  const [sliderPosition, setSliderPosition] = useState(15);
  const containerRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(5, Math.min(95, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };
  
  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 5;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      setSliderPosition(prev => Math.max(5, prev - step));
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      setSliderPosition(prev => Math.min(95, prev + step));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSliderPosition(5);
    } else if (e.key === 'End') {
      e.preventDefault();
      setSliderPosition(95);
    }
  };
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) handleMove(e.clientX);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging) handleMove(e.touches[0].clientX);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging]);
  
  return (
    <div className="py-16 bg-[hsl(30,25%,97%)]">
      <div className="max-w-5xl mx-auto px-6">
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-sm font-medium text-[hsl(18,65%,45%)] uppercase tracking-wider mb-4 block">
            Black Box Protection
          </span>
          <h2 className="text-3xl sm:text-4xl font-normal text-[hsl(25,30%,12%)] mb-4" style={{ fontFamily: "'Lora', Georgia, serif" }}>
            From nothing to everything documented
          </h2>
          <p className="text-lg text-[hsl(25,20%,40%)]">
            Compare traditional record-keeping with LegalNote's cryptographic audit trail
          </p>
        </motion.div>
        
        <motion.div
          ref={containerRef}
          className="relative rounded-2xl overflow-hidden shadow-2xl border border-[hsl(30,20%,85%)] select-none"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          {/* Before - Traditional: Nothing */}
          <div className="relative h-[420px] bg-[hsl(40,30%,95%)]">
            <div className="absolute inset-0 p-8 flex flex-col">
              <div className="mb-6">
                <span className="text-xs font-medium text-[hsl(0,50%,50%)] uppercase tracking-wider bg-[hsl(0,50%,95%)] px-3 py-1 rounded-full">
                  Traditional Approach
                </span>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="text-center opacity-40">
                  <FileQuestion className="w-16 h-16 mx-auto mb-4 text-[hsl(25,15%,50%)]" />
                  <p className="text-lg text-[hsl(25,15%,40%)] font-medium mb-2">No Audit Trail</p>
                </div>
                <div 
                  className="mt-8 text-base text-[hsl(25,15%,45%)] text-center max-w-sm space-y-2"
                  style={{ fontFamily: "'Caveat', cursive" }}
                >
                  <p>"When exactly did we discuss that?"</p>
                  <p>"Who made this change and why?"</p>
                  <p>"Did the client actually consent?"</p>
                </div>
              </div>
              <div className="mt-auto pt-4 border-t border-dashed border-[hsl(25,15%,75%)]">
                <div className="flex items-center gap-2 text-sm text-[hsl(0,50%,45%)]">
                  <AlertTriangle className="w-4 h-4" />
                  <span>If challenged, you're relying on memory</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* After - LegalNote: Everything Documented */}
          <div 
            className="absolute inset-0 h-[420px] bg-white overflow-hidden"
            style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
          >
            <div className="absolute inset-0 p-6 sm:p-8">
              <div className="mb-4 flex items-center gap-3">
                <span className="text-xs font-medium text-[hsl(130,50%,35%)] uppercase tracking-wider bg-[hsl(130,50%,95%)] px-3 py-1 rounded-full">
                  LegalNote Audit Trail
                </span>
                <Badge className="bg-[hsl(18,70%,42%)] text-white text-xs">Cryptographically Signed</Badge>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3 p-3 bg-[hsl(130,40%,97%)] rounded-lg border border-[hsl(130,30%,90%)]">
                  <div className="w-2 h-2 rounded-full bg-[hsl(130,50%,45%)] mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-xs text-[hsl(25,15%,45%)]">14:32:07</span>
                      <span className="text-[hsl(25,30%,20%)]">Recording started</span>
                    </div>
                    <p className="text-xs text-[hsl(130,50%,35%)]">Verbal consent obtained from Mrs Thompson</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-[hsl(30,30%,98%)] rounded-lg border border-[hsl(30,20%,90%)]">
                  <div className="w-2 h-2 rounded-full bg-[hsl(18,60%,50%)] mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-xs text-[hsl(25,15%,45%)]">15:19:23</span>
                      <span className="text-[hsl(25,30%,20%)]">Transcript generated</span>
                    </div>
                    <p className="text-xs text-[hsl(25,15%,50%)]">AI transcription with speaker diarization</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-[hsl(30,30%,98%)] rounded-lg border border-[hsl(30,20%,90%)]">
                  <div className="w-2 h-2 rounded-full bg-[hsl(18,60%,50%)] mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-xs text-[hsl(25,15%,45%)]">15:22:45</span>
                      <span className="text-[hsl(25,30%,20%)]">Document reviewed</span>
                    </div>
                    <p className="text-xs text-[hsl(25,15%,50%)]">J. Williams viewed attendance note</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-[hsl(220,40%,97%)] rounded-lg border border-[hsl(220,30%,90%)]">
                  <div className="w-2 h-2 rounded-full bg-[hsl(220,60%,50%)] mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-xs text-[hsl(25,15%,45%)]">15:24:12</span>
                      <span className="text-[hsl(25,30%,20%)]">Client version shared</span>
                    </div>
                    <p className="text-xs text-[hsl(220,50%,45%)] font-mono break-all">SHA-256: a3f8b2c1...e9d4</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[hsl(30,20%,90%)]">
                <div className="flex items-center gap-2 text-xs text-[hsl(130,50%,35%)]">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Every action timestamped, hashed, and tamper-evident</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Slider Handle */}
          <div 
            ref={sliderRef}
            role="slider"
            aria-label="Comparison slider - drag or use arrow keys to compare traditional record-keeping with LegalNote audit trail"
            aria-valuemin={5}
            aria-valuemax={95}
            aria-valuenow={Math.round(sliderPosition)}
            aria-valuetext={`${Math.round(sliderPosition)}% LegalNote view`}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onMouseDown={handleMouseDown}
            onTouchStart={handleMouseDown}
            className="absolute top-0 bottom-0 w-1 bg-[hsl(18,70%,42%)] cursor-ew-resize z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(18,70%,42%)] focus-visible:ring-offset-2"
            style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-[hsl(18,70%,42%)] shadow-lg flex items-center justify-center touch-none">
              <div className="flex gap-0.5">
                <div className="w-0.5 h-4 bg-white rounded-full" />
                <div className="w-0.5 h-4 bg-white rounded-full" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// Animated gradient mesh background
function GradientMesh() {
  const prefersReducedMotion = useReducedMotion();
  
  if (prefersReducedMotion) {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-1/2 -left-1/2 w-full h-full rounded-full opacity-30"
          style={{
            background: "radial-gradient(circle, hsl(18,60%,70%) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute -bottom-1/2 -right-1/2 w-full h-full rounded-full opacity-20"
          style={{
            background: "radial-gradient(circle, hsl(25,50%,75%) 0%, transparent 70%)",
          }}
        />
      </div>
    );
  }
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute -top-1/2 -left-1/2 w-full h-full rounded-full opacity-30"
        style={{
          background: "radial-gradient(circle, hsl(18,60%,70%) 0%, transparent 70%)",
        }}
        animate={{
          x: [0, 100, 0],
          y: [0, 50, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute -bottom-1/2 -right-1/2 w-full h-full rounded-full opacity-20"
        style={{
          background: "radial-gradient(circle, hsl(25,50%,75%) 0%, transparent 70%)",
        }}
        animate={{
          x: [0, -80, 0],
          y: [0, -60, 0],
          scale: [1.2, 1, 1.2],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}

// StatCounter component to avoid hooks in loops
function StatCounter({ value, prefix, suffix, label, index }: { value: number; prefix?: string; suffix: string; label: string; index: number }) {
  const counter = useCounter(value, 2000);
  const prefersReducedMotion = useReducedMotion();
  
  return (
    <motion.div
      ref={counter.ref}
      className="text-center"
      initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: prefersReducedMotion ? 0 : index * 0.1, duration: prefersReducedMotion ? 0 : 0.5 }}
    >
      <div className="text-4xl sm:text-5xl font-bold text-white mb-2" style={{ fontFamily: "'Lora', Georgia, serif" }}>
        {prefix}{prefersReducedMotion ? value : counter.count}{suffix}
      </div>
      <div className="text-sm text-white/60">{label}</div>
    </motion.div>
  );
}

// Trust badges with floating animation (respects reduced motion)
function TrustBadges() {
  const prefersReducedMotion = useReducedMotion();
  
  const complianceItems = [
    {
      obligation: "SRA Code of Conduct",
      reference: "Paragraph 3.3",
      requirement: "Keep records of decisions and actions relating to client matters",
      howLegalNoteHelps: "Automated attendance notes capture decisions and actions in real-time, linked to the matter record with timestamps.",
      icon: FileText,
    },
    {
      obligation: "COLP Expectations",
      reference: "Compliance Officer Role",
      requirement: "Evidence that file management policies are followed across the firm",
      howLegalNoteHelps: "Audit trail with cryptographic signatures provides reviewable evidence of consistent documentation practices.",
      icon: ClipboardCheck,
    },
    {
      obligation: "UK GDPR",
      reference: "Articles 5, 17 & 32",
      requirement: "Data minimisation, right to erasure, and appropriate security measures",
      howLegalNoteHelps: "GDPR-compliant auto-deletion, UK data residency, encryption at rest and in transit, consent documentation.",
      icon: ShieldCheck,
    },
    {
      obligation: "PI Insurance Defensibility",
      reference: "Claims Investigation",
      requirement: "Contemporaneous evidence of advice given and instructions received",
      howLegalNoteHelps: "Timestamped, speaker-attributed records created at point of instruction, not reconstructed weeks later.",
      icon: Scale,
    },
  ];

  return (
    <div className="space-y-6" data-testid="trust-compliance-grid">
      {complianceItems.map((item, index) => (
        <motion.div
          key={item.obligation}
          className="p-6 rounded-xl bg-white border border-[hsl(30,20%,85%)] shadow-sm"
          initial={prefersReducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.4, delay: prefersReducedMotion ? 0 : index * 0.1 }}
          data-testid={`compliance-item-${index}`}
        >
          <div className="flex flex-col md:flex-row md:items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(18,55%,88%)] to-[hsl(18,60%,80%)] flex items-center justify-center">
                <item.icon className="w-6 h-6 text-[hsl(18,65%,42%)]" />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h3 className="text-lg font-medium text-[hsl(25,30%,12%)]" data-testid={`text-obligation-${index}`}>{item.obligation}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[hsl(25,30%,92%)] text-[hsl(25,30%,40%)]" data-testid={`text-reference-${index}`}>
                  {item.reference}
                </span>
              </div>
              <p className="text-sm text-[hsl(25,20%,50%)] mb-3 italic" data-testid={`text-requirement-${index}`}>
                "{item.requirement}"
              </p>
              <p className="text-sm text-[hsl(25,20%,35%)]" data-testid={`text-how-helps-${index}`}>
                <span className="font-medium text-[hsl(18,55%,40%)]">How LegalNote helps:</span> {item.howLegalNoteHelps}
              </p>
            </div>
          </div>
        </motion.div>
      ))}
      
      {/* Summary badges */}
      <motion.div 
        className="flex flex-wrap items-center justify-center gap-4 pt-6 text-sm text-[hsl(25,20%,45%)]"
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.5, delay: prefersReducedMotion ? 0 : 0.5 }}
        data-testid="compliance-summary-badges"
      >
        <span className="flex items-center gap-1.5" data-testid="text-badge-uk-datacentres">
          <span className="w-2 h-2 rounded-full bg-[hsl(130,40%,45%)]" />
          UK Data Centres
        </span>
        <span className="flex items-center gap-1.5" data-testid="text-badge-encryption">
          <span className="w-2 h-2 rounded-full bg-[hsl(130,40%,45%)]" />
          Encryption at Rest & Transit
        </span>
        <span className="flex items-center gap-1.5" data-testid="text-badge-privilege-protected">
          <span className="w-2 h-2 rounded-full bg-[hsl(130,40%,45%)]" />
          Privilege Protected
        </span>
        <span className="flex items-center gap-1.5" data-testid="text-badge-tamper-detection">
          <span className="w-2 h-2 rounded-full bg-[hsl(130,40%,45%)]" />
          Tamper-Detection Signatures
        </span>
      </motion.div>
    </div>
  );
}

// Final CTA with animated background (respects reduced motion)
function FinalCTA({ onRequestAccess }: { onRequestAccess: (source: string) => void }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="relative py-24 overflow-hidden bg-[hsl(20,35%,18%)]">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {prefersReducedMotion ? (
          <>
            <div
              className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full"
              style={{
                background: "radial-gradient(circle, hsl(18,50%,30%) 0%, transparent 70%)",
              }}
            />
            <div
              className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full"
              style={{
                background: "radial-gradient(circle, hsl(25,40%,25%) 0%, transparent 70%)",
              }}
            />
          </>
        ) : (
          <>
            <motion.div
              className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full"
              style={{
                background: "radial-gradient(circle, hsl(18,50%,30%) 0%, transparent 70%)",
              }}
              animate={{
                x: [0, 50, 0],
                y: [0, 30, 0],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 15,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.div
              className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full"
              style={{
                background: "radial-gradient(circle, hsl(25,40%,25%) 0%, transparent 70%)",
              }}
              animate={{
                x: [0, -40, 0],
                y: [0, -40, 0],
                scale: [1.2, 1, 1.2],
              }}
              transition={{
                duration: 18,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </>
        )}
      </div>
      
      <div className="relative max-w-4xl mx-auto px-6 text-center">
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.6 }}
        >
          <motion.h2 
            className="text-4xl sm:text-5xl font-normal text-white mb-6" 
            style={{ fontFamily: "'Lora', Georgia, serif" }}
            initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.7 }}
          >
            Never have a file note gap again
          </motion.h2>
          <motion.p 
            className="text-xl text-[hsl(30,30%,70%)] max-w-2xl mx-auto mb-10" 
            style={{ fontFamily: "'Lora', Georgia, serif" }}
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.6, delay: prefersReducedMotion ? 0 : 0.2 }}
          >
            Join solicitors across the UK who are creating contemporaneous, evidential attendance records with LegalNote.
          </motion.p>
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.5, delay: prefersReducedMotion ? 0 : 0.3 }}
            whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
          >
            <Button 
              onClick={() => onRequestAccess("final_cta")} 
              size="lg"
              className="bg-[hsl(18,70%,42%)] text-white hover:bg-[hsl(18,70%,38%)] rounded-full text-base px-10 py-6 shadow-2xl shadow-[hsl(18,60%,30%)]/30"
              data-testid="button-cta-signup"
            >
              Request Early Access
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

// Document flow animation component
function DocumentFlowAnimation() {
  const prefersReducedMotion = useReducedMotion();
  const steps = [
    { icon: Mic, label: "Record", color: "hsl(18,65%,45%)" },
    { icon: Brain, label: "Process", color: "hsl(25,50%,45%)" },
    { icon: FileOutput, label: "Document", color: "hsl(20,60%,40%)" },
  ];

  return (
    <div className="flex items-center justify-start sm:justify-center gap-2 sm:gap-4 py-4 sm:py-8">
      {steps.map((step, index) => (
        <motion.div
          key={step.label}
          className="flex items-center gap-1.5 sm:gap-4"
          initial={prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: prefersReducedMotion ? 0 : index * 0.3, duration: prefersReducedMotion ? 0 : 0.5 }}
        >
          <motion.div
            className="relative"
            animate={prefersReducedMotion ? {} : {
              y: [0, -4, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: index * 0.4,
              ease: "easeInOut",
            }}
          >
            <div
              className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-md sm:shadow-lg"
              style={{ backgroundColor: step.color }}
            >
              <step.icon className="w-5 h-5 sm:w-8 sm:h-8 text-white" />
            </div>
            {!prefersReducedMotion && (
              <motion.div
                className="absolute -inset-0.5 sm:-inset-1 rounded-xl sm:rounded-2xl opacity-30"
                style={{ backgroundColor: step.color }}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.1, 0.3],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: index * 0.4,
                }}
              />
            )}
          </motion.div>
          <span className="text-xs sm:text-sm font-medium text-[hsl(25,25%,30%)]">{step.label}</span>
          {index < steps.length - 1 && (
            <motion.div
              className="flex items-center"
              initial={prefersReducedMotion ? { scaleX: 1 } : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: prefersReducedMotion ? 0 : index * 0.3 + 0.5, duration: prefersReducedMotion ? 0 : 0.3 }}
            >
              <div className="w-4 sm:w-12 h-0.5 bg-gradient-to-r from-[hsl(18,50%,60%)] to-[hsl(25,40%,65%)]" />
              <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 text-[hsl(25,40%,55%)]" />
            </motion.div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

interface Price {
  id: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string } | null;
  metadata: Record<string, string>;
}

interface Product {
  id: string;
  name: string;
  description: string;
  metadata: Record<string, string>;
  prices: Price[];
}

export default function Landing() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'quarterly' | 'annual'>('quarterly');
  const [isScrolled, setIsScrolled] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showEarlyAccessForm, setShowEarlyAccessForm] = useState(false);
  const [earlyAccessSource, setEarlyAccessSource] = useState("landing_page");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activePricingCard, setActivePricingCard] = useState(0);
  const [isInPricingSection, setIsInPricingSection] = useState(false);
  const { scrollY } = useScroll();
  const prefersReducedMotion = useReducedMotion();
  const pricingRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  
  const exploreModal = useExploreModal("pricing-end");
  
  // Track scroll for sticky nav blur effect and pricing section visibility
  useEffect(() => {
    const unsubscribe = scrollY.on("change", (y) => {
      setIsScrolled(y > 50);
      
      // Check if we're in the pricing section (hide floating CTA)
      if (pricingRef.current && footerRef.current) {
        const pricingTop = pricingRef.current.offsetTop - 100;
        const footerTop = footerRef.current.offsetTop - 100;
        setIsInPricingSection(y >= pricingTop && y < footerTop);
      }
    });
    return () => unsubscribe();
  }, [scrollY]);

  const handleLogin = () => {
    if (isPreviewMode) {
      setShowPreviewModal(true);
      return;
    }
    window.location.href = "/api/login";
  };

  const handleRequestAccess = (source: string = "hero") => {
    setEarlyAccessSource(source);
    setShowEarlyAccessForm(true);
  };

  const { data: productsData } = useQuery<{ products: Product[] }>({
    queryKey: ['/api/stripe/products'],
  });

  const products = productsData?.products || [];
  const soloProduct = products.find(p => p.metadata?.plan === 'solo');
  const teamProduct = products.find(p => p.metadata?.plan === 'team');

  const getSoloPrice = () => {
    switch (billingPeriod) {
      case 'monthly': return 149;
      case 'quarterly': return 399;
      case 'annual': return 1428;
    }
  };

  const getTeamPrice = () => {
    switch (billingPeriod) {
      case 'monthly': return 299;
      case 'quarterly': return 799;
      case 'annual': return 2868;
    }
  };

  const getSeatPrice = () => {
    switch (billingPeriod) {
      case 'monthly': return 69;
      case 'quarterly': return 179;
      case 'annual': return 690;
    }
  };

  const getBillingLabel = () => {
    switch (billingPeriod) {
      case 'monthly': return 'month';
      case 'quarterly': return 'quarter';
      case 'annual': return 'year';
    }
  };

  const getSoloEffectiveMonthly = () => {
    switch (billingPeriod) {
      case 'monthly': return null;
      case 'quarterly': return '£133/month effective';
      case 'annual': return '£119/month effective';
    }
  };

  const getTeamEffectiveMonthly = () => {
    switch (billingPeriod) {
      case 'monthly': return null;
      case 'quarterly': return '£266/month effective';
      case 'annual': return '£239/month effective';
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Scroll Progress Indicator */}
      <ScrollProgressBar />
      
      {/* Floating CTA - Fixed at bottom on mobile, fades out in pricing section */}
      <motion.div 
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 md:hidden"
        initial={{ opacity: 1 }}
        animate={{ opacity: isInPricingSection ? 0 : 1, pointerEvents: isInPricingSection ? 'none' : 'auto' }}
        transition={{ duration: 0.3 }}
      >
        <Button 
          onClick={() => handleRequestAccess("floating_cta")}
          size="lg"
          className="bg-[hsl(18,70%,42%)] text-white rounded-full shadow-2xl"
          data-testid="button-floating-cta"
        >
          Request Early Access
        </Button>
      </motion.div>

      {/* Spacer for fixed nav */}
      <div className="h-[72px]" />

      {/* Announcement Bar */}
      <div className="bg-[hsl(20,40%,35%)] text-white">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-center gap-2 text-sm">
          <span className="font-medium">News</span>
          <span className="text-white/60">|</span>
          <span>LegalNote now integrates with Clio Manage</span>
          <button 
            onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
            className="font-medium hover:underline ml-1 text-white"
            data-testid="button-announcement-readmore"
          >
            Read more →
          </button>
        </div>
      </div>

      {/* Fixed Navigation with Blur */}
      <motion.nav 
        className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${
          isScrolled 
            ? 'bg-white/90 backdrop-blur-lg shadow-sm border-b border-[hsl(30,20%,90%)]' 
            : 'bg-white'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Logo variant="wordmark" size="xl" tone="light" />
            </motion.div>
            
            {/* Desktop Navigation - visible on lg and above */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="hidden lg:flex items-center gap-6"
            >
              <Button 
                variant="ghost"
                size="sm"
                onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-[hsl(25,25%,25%)] hover:text-[hsl(18,65%,45%)] font-normal text-base px-4"
                data-testid="button-nav-how-it-works"
              >
                How It Works
              </Button>
              <Button 
                variant="ghost"
                size="sm"
                className="text-[hsl(25,25%,25%)] hover:text-[hsl(18,65%,45%)] font-normal text-base px-4"
                data-testid="button-nav-features"
                asChild
              >
                <Link href="/features">
                  Features
                </Link>
              </Button>
              <Button 
                variant="ghost"
                size="sm"
                onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-[hsl(25,25%,25%)] hover:text-[hsl(18,65%,45%)] font-normal text-base px-4"
                data-testid="button-nav-pricing"
              >
                Pricing
              </Button>
              <Button 
                variant="ghost"
                size="sm"
                className="text-[hsl(25,25%,25%)] hover:text-[hsl(18,65%,45%)] font-normal text-base px-4"
                data-testid="button-nav-security"
                asChild
              >
                <Link href="/security">
                  Security
                </Link>
              </Button>
              <Button 
                variant="ghost"
                size="sm"
                onClick={handleLogin}
                className="text-[hsl(25,25%,25%)] hover:text-[hsl(18,65%,45%)] font-normal text-base px-4"
                data-testid="button-nav-login"
              >
                Log in
              </Button>
            </motion.div>

            {/* Mobile/Tablet Navigation - visible below lg */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="flex lg:hidden items-center gap-3"
            >
              <Button 
                variant="ghost"
                size="sm"
                onClick={handleLogin}
                className="text-[hsl(25,25%,25%)] hover:text-[hsl(18,65%,45%)] font-normal text-sm px-3"
                data-testid="button-nav-login-mobile"
              >
                Log in
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-[hsl(25,25%,25%)] hover:text-[hsl(18,65%,45%)]"
                data-testid="button-nav-burger"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden border-t border-[hsl(30,20%,90%)] bg-white"
            >
              <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-2">
                <Button 
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                    setMobileMenuOpen(false);
                  }}
                  className="text-[hsl(25,25%,25%)] hover:text-[hsl(18,65%,45%)] font-normal text-base justify-start px-4 py-3"
                  data-testid="button-nav-how-it-works-mobile"
                >
                  How It Works
                </Button>
                <Button 
                  variant="ghost"
                  size="sm"
                  className="text-[hsl(25,25%,25%)] hover:text-[hsl(18,65%,45%)] font-normal text-base justify-start px-4 py-3"
                  data-testid="button-nav-features-mobile"
                  asChild
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Link href="/features">
                    Features
                  </Link>
                </Button>
                <Button 
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                    setMobileMenuOpen(false);
                  }}
                  className="text-[hsl(25,25%,25%)] hover:text-[hsl(18,65%,45%)] font-normal text-base justify-start px-4 py-3"
                  data-testid="button-nav-pricing-mobile"
                >
                  Pricing
                </Button>
                <Button 
                  variant="ghost"
                  size="sm"
                  className="text-[hsl(25,25%,25%)] hover:text-[hsl(18,65%,45%)] font-normal text-base justify-start px-4 py-3"
                  data-testid="button-nav-security-mobile"
                  asChild
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Link href="/security">
                    Security
                  </Link>
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* Hero Section - Editorial Style with Image */}
      <div className="relative bg-white overflow-hidden">
        <GradientMesh />
        <div className="relative max-w-7xl mx-auto px-6 pt-8 sm:pt-12 pb-12">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between lg:gap-8">
            {/* Left - Text Content */}
            <motion.div 
              className="lg:flex-shrink-0 lg:w-[55%] max-w-2xl"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <motion.h1 
                className="text-[2.5rem] sm:text-5xl lg:text-6xl font-normal text-[hsl(25,30%,12%)] mb-4 leading-[1.1] tracking-tight" 
                style={{ fontFamily: "'Lora', Georgia, serif" }}
                data-testid="text-app-title"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                Meeting to matter,<br />
                built for compliance.
              </motion.h1>
              
              {/* Typewriter tagline */}
              <motion.div
                className="h-8 mb-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                <span className="text-lg text-[hsl(18,65%,45%)] font-medium">
                  <TypewriterText 
                    texts={[
                      "Record with consent",
                      "Transcribe with accuracy", 
                      "Document with confidence",
                      "Evidence with clarity"
                    ]} 
                  />
                </span>
              </motion.div>
              
              {/* Document flow animation - Record → Process → Document */}
              <motion.div
                className="mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.8 }}
              >
                <DocumentFlowAnimation />
              </motion.div>
              
              <motion.p 
                className="text-lg text-[hsl(25,20%,40%)] leading-relaxed mb-6" 
                style={{ fontFamily: "'Lora', Georgia, serif" }}
                data-testid="text-app-description"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                A complaint arrives about advice you gave two years ago. Your notes are sparse, the client remembers differently. With LegalNote, every meeting is captured, consent documented, timestamped and audit-ready.
              </motion.p>
              
              {/* CTA Button */}
              <motion.div 
                className="mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <Button 
                  onClick={() => handleRequestAccess("hero")}
                  className="bg-[hsl(18,70%,42%)] text-white hover:bg-[hsl(18,70%,38%)] rounded-full px-8 py-5 text-base"
                  data-testid="button-get-started"
                >
                  Request Early Access
                </Button>
              </motion.div>
            </motion.div>
            
            {/* Right - Hero Image */}
            <motion.div
              className="hidden lg:flex lg:flex-1 lg:justify-center lg:items-start"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              data-testid="container-hero-image"
            >
              <div className="relative rounded-xl overflow-hidden shadow-xl w-72">
                <img 
                  src={heroSolicitorImage} 
                  alt="Professional solicitor in client meeting"
                  className="w-full h-auto object-cover aspect-[3/4]"
                  data-testid="img-hero-solicitor"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              </div>
            </motion.div>
          </div>
        </div>

      </div>

      {/* What LegalNote Does - Value Proposition (moved to top) */}
      <div className="relative bg-[hsl(30,25%,94%)] py-20 border-y border-[hsl(30,20%,85%)]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl sm:text-4xl font-normal text-[hsl(25,30%,12%)] mb-6" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              Attendance records that evidence professional judgement
            </h2>
            <p className="text-lg text-[hsl(25,20%,40%)] leading-relaxed max-w-3xl mx-auto mb-4" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              LegalNote captures what was said, what was decided, and what must happen next, then forms a reviewable attendance note that preserves reasoning, actions, and instructions for professional finalisation. Records are timestamped, contemporaneous, and aligned with how regulators expect legal work to be evidenced.
            </p>
            <p className="text-base text-[hsl(25,20%,50%)] leading-relaxed max-w-2xl mx-auto" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              Fee-earners spend less time reconstructing conversations and more time advising clients. A thoughtful investment in your team's wellbeing and your firm's defensibility.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Interactive Comparison Slider - moved up for impact */}
      <ComparisonSlider />

      {/* Trust Logos Marquee */}
      <TrustLogosMarquee />

      {/* Animated Statistics Section */}
      <div className="relative bg-[hsl(20,35%,18%)] py-16 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatCounter value={2} prefix="<" suffix=" min" label="Meeting-to-Matter" index={0} />
            <StatCounter value={100} suffix="%" label="Audit-ready" index={1} />
            <StatCounter value={500} suffix="+" label="Hours documented" index={2} />
            <StatCounter value={100} suffix="%" label="GDPR compliant" index={3} />
          </div>
        </div>
      </div>

      {/* Integration Logos Section */}
      <div className="bg-[hsl(30,20%,97%)] py-6 border-b border-[hsl(30,15%,90%)]" data-testid="section-integrations">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-center gap-8 flex-wrap">
            <span className="text-xs text-[hsl(25,15%,55%)] uppercase tracking-wider" data-testid="text-integrates-with">Integrates with</span>
            <div className="flex items-center gap-6">
              {/* Microsoft */}
              <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                <svg className="w-5 h-5" viewBox="0 0 23 23" fill="none">
                  <rect width="11" height="11" fill="hsl(25,20%,50%)" />
                  <rect x="12" width="11" height="11" fill="hsl(25,20%,50%)" />
                  <rect y="12" width="11" height="11" fill="hsl(25,20%,50%)" />
                  <rect x="12" y="12" width="11" height="11" fill="hsl(25,20%,50%)" />
                </svg>
                <span className="text-sm text-[hsl(25,20%,45%)] font-medium">Microsoft</span>
              </div>
              {/* Google */}
              <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="hsl(25,20%,50%)"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="hsl(25,20%,50%)"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="hsl(25,20%,50%)"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="hsl(25,20%,50%)"/>
                </svg>
                <span className="text-sm text-[hsl(25,20%,45%)] font-medium">Google</span>
              </div>
              {/* Clio */}
              <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                <div className="w-5 h-5 rounded bg-[hsl(25,20%,50%)] flex items-center justify-center">
                  <span className="text-white text-xs font-bold">C</span>
                </div>
                <span className="text-sm text-[hsl(25,20%,45%)] font-medium">Clio</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works Section - Enhanced with workflow infographic */}
      <div id="how-it-works" className="relative py-24 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <motion.span 
              className="text-sm font-medium text-[hsl(18,65%,45%)] uppercase tracking-wider mb-4 block"
              initial={{ opacity: 0, letterSpacing: "0.1em" }}
              whileInView={{ opacity: 1, letterSpacing: "0.2em" }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              How It Works
            </motion.span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-normal text-[hsl(25,30%,12%)] mb-6" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              Consent documented before anyone speaks.<br className="hidden sm:block" />{" "}
              Audit-ready records sealed before anyone leaves.
            </h2>
            <p className="text-lg sm:text-xl text-[hsl(25,20%,40%)] max-w-3xl mx-auto" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              This is infrastructure, not software. A methodology that captures your expertise while you focus on your client.
            </p>
          </motion.div>

          {/* Workflow Infographic */}
          <WorkflowInfographic />
          
          {/* Closing statement */}
          <motion.p 
            className="text-center mt-12 text-lg text-[hsl(25,30%,20%)] max-w-2xl mx-auto" 
            style={{ fontFamily: "'Lora', Georgia, serif" }}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            Your conversation becomes your evidence. Your judgment shapes the final record.
          </motion.p>
        </div>
      </div>

      {/* Trust & Compliance Section - Compact */}
      <div id="security-compliance" className="relative bg-[hsl(30,25%,94%)] py-10 border-y border-[hsl(30,20%,85%)]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            className="text-center mb-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-xs font-medium text-[hsl(18,65%,45%)] uppercase tracking-wider mb-2 block">
              Security & Compliance
            </span>
            <h2 className="text-2xl sm:text-3xl font-normal text-[hsl(25,30%,12%)] mb-2" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              Built to evidence professional judgement
            </h2>
            <p className="text-base text-[hsl(25,20%,40%)] max-w-2xl mx-auto" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              Detailed attendance notes as a core strand of evidencing competent service.
            </p>
          </motion.div>

          <TrustBadges />
        </div>
      </div>

      {/* Lead Magnet Section */}
      <div className="relative bg-white py-24 border-b border-[hsl(30,20%,88%)]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left - Content */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <span className="text-sm font-medium text-[hsl(18,65%,45%)] uppercase tracking-wider mb-4 block" data-testid="text-lead-magnet-label">
                Practice Briefing
              </span>
              <h2 className="text-3xl sm:text-4xl font-normal text-[hsl(25,30%,12%)] mb-6" style={{ fontFamily: "'Lora', Georgia, serif" }} data-testid="text-lead-magnet-title">
                The Defensible Record
              </h2>
              <p className="text-lg text-[hsl(25,20%,40%)] mb-6" style={{ fontFamily: "'Lora', Georgia, serif" }} data-testid="text-lead-magnet-subtitle">
                The Evidence-First Documentation Methodology
              </p>
              <ul className="space-y-4 mb-8">
                {[
                  'What makes a file note "defensible" in an SRA complaint',
                  'The 3 elements every attendance note needs',
                  'Common documentation gaps that expose firms to PI claims',
                  'Sample attendance note template you can use today'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[hsl(18,50%,92%)] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5 text-[hsl(18,65%,45%)]" />
                    </div>
                    <span className="text-[hsl(25,20%,35%)]">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-[hsl(25,15%,50%)] italic">
                Practical frameworks to strengthen your documentation - whether you use LegalNote or not.
              </p>
            </motion.div>

            {/* Right - Form Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="relative"
            >
              <div className="bg-[hsl(30,25%,96%)] rounded-2xl p-8 border border-[hsl(30,20%,88%)]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(18,55%,88%)] to-[hsl(18,60%,78%)] flex items-center justify-center">
                    <FileText className="w-6 h-6 text-[hsl(18,65%,40%)]" />
                  </div>
                  <div>
                    <p className="font-medium text-[hsl(25,30%,12%)]" data-testid="text-lead-magnet-format">5-page PDF Guide</p>
                    <p className="text-sm text-[hsl(25,20%,45%)]" data-testid="text-lead-magnet-delivery">Sent to your inbox</p>
                  </div>
                </div>
                <Button 
                  onClick={() => handleRequestAccess("lead_magnet")}
                  size="lg"
                  className="w-full bg-[hsl(18,70%,42%)] text-white"
                  data-testid="button-lead-magnet"
                >
                  <Download className="w-4 h-4 mr-2" />
                  See What's Missing
                </Button>
                <p className="text-xs text-center text-[hsl(25,15%,55%)] mt-4">
                  We'll also add you to our early access list for product updates.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Pricing Section - Compact */}
      <div id="pricing" ref={pricingRef} className="relative bg-white py-16">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div 
            className="text-center mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-xs font-medium text-[hsl(18,65%,45%)] uppercase tracking-wider mb-3 block">
              Pricing
            </span>
            <h2 className="text-3xl sm:text-4xl font-normal text-[hsl(25,30%,12%)] mb-4" style={{ fontFamily: "'Lora', Georgia, serif" }}>Simple, transparent pricing</h2>
            <p className="text-lg text-[hsl(25,20%,40%)] max-w-xl mx-auto mb-6" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              Choose the plan that fits your practice. 14-day professional evaluation included.
            </p>
            
            {/* Billing Period Tabs - pill style with background */}
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-1 p-1 bg-[hsl(30,20%,93%)] border border-[hsl(30,20%,85%)] rounded-xl">
                <button
                  onClick={() => setBillingPeriod('monthly')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    billingPeriod === 'monthly' 
                      ? 'bg-white text-[hsl(25,30%,12%)] shadow-sm' 
                      : 'text-[hsl(25,20%,45%)] hover:text-[hsl(25,25%,25%)]'
                  }`}
                  data-testid="button-monthly-billing"
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingPeriod('quarterly')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
                    billingPeriod === 'quarterly' 
                      ? 'bg-white text-[hsl(25,30%,12%)] shadow-sm' 
                      : 'text-[hsl(25,20%,45%)] hover:text-[hsl(25,25%,25%)]'
                  }`}
                  data-testid="button-quarterly-billing"
                >
                  Quarterly
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${billingPeriod === 'quarterly' ? 'bg-[hsl(18,55%,40%)] text-white' : 'bg-[hsl(25,30%,88%)] text-[hsl(25,40%,35%)]'}`} data-testid="badge-save-quarterly">
                    Save 11%
                  </span>
                </button>
                <button
                  onClick={() => setBillingPeriod('annual')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
                    billingPeriod === 'annual' 
                      ? 'bg-white text-[hsl(25,30%,12%)] shadow-sm' 
                      : 'text-[hsl(25,20%,45%)] hover:text-[hsl(25,25%,25%)]'
                  }`}
                  data-testid="button-annual-billing"
                >
                  Annual
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${billingPeriod === 'annual' ? 'bg-[hsl(18,55%,40%)] text-white' : 'bg-[hsl(25,30%,88%)] text-[hsl(25,40%,35%)]'}`} data-testid="badge-save-annual">
                    Save 20%
                  </span>
                </button>
              </div>
            </div>
          </motion.div>

          {/* Cloud Subscriptions - Mobile Carousel */}
          <div className="md:hidden relative mb-16">
            {/* Side Navigation Arrows */}
            <button
              onClick={() => setActivePricingCard(0)}
              className={`absolute -left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md ${
                activePricingCard === 0 
                  ? 'bg-[hsl(30,20%,90%)] text-[hsl(25,25%,60%)]' 
                  : 'bg-white text-[hsl(25,25%,35%)] hover:bg-[hsl(30,20%,95%)]'
              }`}
              disabled={activePricingCard === 0}
              data-testid="button-pricing-prev"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setActivePricingCard(1)}
              className={`absolute -right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md ${
                activePricingCard === 1 
                  ? 'bg-[hsl(30,20%,90%)] text-[hsl(25,25%,60%)]' 
                  : 'bg-white text-[hsl(25,25%,35%)] hover:bg-[hsl(30,20%,95%)]'
              }`}
              disabled={activePricingCard === 1}
              data-testid="button-pricing-next"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            
            {/* Cards Container */}
            <div className="overflow-hidden mx-10">
              <div 
                className="flex transition-transform duration-300 ease-out"
                style={{ transform: `translateX(-${activePricingCard * 100}%)` }}
              >
                {/* Solo Card */}
                <div className="w-full flex-shrink-0 px-1.5">
                  <div className="h-full p-4 rounded-lg bg-white border border-[hsl(30,20%,85%)] flex flex-col">
                    {billingPeriod === 'quarterly' && (
                      <div className="mb-3">
                        <span className="inline-block px-3 py-1 rounded-full bg-[hsl(18,55%,40%)] text-white text-xs font-medium" data-testid="badge-popular-solo-mobile">
                          Most Popular
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-[hsl(30,25%,92%)] flex items-center justify-center">
                        <User className="w-5 h-5 text-[hsl(25,25%,35%)]" />
                      </div>
                      <h3 className="text-2xl font-medium text-[hsl(25,30%,12%)]">Solo</h3>
                    </div>
                    <p className="text-[hsl(25,20%,45%)] mb-4">Perfect for solo practitioners</p>
                    <div className="mb-4 flex items-baseline">
                      <span className="text-4xl font-medium text-[hsl(25,30%,12%)]">£{getSoloPrice()}</span>
                      <span className="text-[hsl(25,20%,45%)] ml-2">/{getBillingLabel()}</span>
                    </div>
                    {getSoloEffectiveMonthly() && (
                      <p className="text-sm text-[hsl(18,65%,45%)] font-medium mb-4">{getSoloEffectiveMonthly()}</p>
                    )}
                    <ul className="space-y-3 mb-6 flex-grow">
                      {['Unlimited recordings', 'AI transcription', 'Attendance notes', 'Black Box security', 'GDPR tools'].map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-[hsl(18,65%,45%)] flex-shrink-0" />
                          <span className="text-[hsl(25,20%,40%)]">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button onClick={() => handleRequestAccess("pricing_solo")} variant="outline" className="w-full mt-auto" data-testid="button-solo-signup-mobile">
                      Request Access
                    </Button>
                  </div>
                </div>
                
                {/* Team Card */}
                <div className="w-full flex-shrink-0 px-1.5">
                  <div className="relative h-full p-4 rounded-lg bg-[hsl(18,40%,92%)] border-2 border-[hsl(18,45%,70%)] flex flex-col">
                    {billingPeriod === 'quarterly' && (
                      <div className="mb-3">
                        <span className="inline-block px-3 py-1 rounded-full bg-[hsl(18,55%,40%)] text-white text-xs font-medium" data-testid="badge-popular-team-mobile">
                          Most Popular
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-[hsl(18,50%,82%)] flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-[hsl(18,65%,40%)]" />
                      </div>
                      <h3 className="text-2xl font-medium text-[hsl(25,30%,12%)]">Team</h3>
                    </div>
                    <p className="text-[hsl(25,20%,45%)] mb-4">For boutique law firms</p>
                    <div className="mb-2 flex items-baseline">
                      <span className="text-4xl font-medium text-[hsl(25,30%,12%)]">£{getTeamPrice()}</span>
                      <span className="text-[hsl(25,20%,45%)] ml-2">/{getBillingLabel()}</span>
                    </div>
                    {getTeamEffectiveMonthly() && (
                      <p className="text-sm text-[hsl(18,65%,45%)] font-medium mb-2">{getTeamEffectiveMonthly()}</p>
                    )}
                    <p className="text-xs text-[hsl(25,20%,45%)] mb-4">2 users included, + £{getSeatPrice()}/{getBillingLabel()} per user</p>
                    <ul className="space-y-3 mb-6 flex-grow">
                      {['Everything in Solo', 'Team collaboration', 'Admin dashboard', 'Priority support'].map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-[hsl(18,65%,45%)] flex-shrink-0" />
                          <span className="text-[hsl(25,20%,35%)]">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button onClick={() => handleRequestAccess("pricing_team")} className="w-full bg-[hsl(18,70%,42%)] text-white mt-auto" data-testid="button-team-signup-mobile">
                      Request Access
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Dot Indicators */}
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setActivePricingCard(0)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${activePricingCard === 0 ? 'bg-[hsl(18,65%,45%)]' : 'bg-[hsl(30,20%,80%)]'}`}
                data-testid="button-pricing-dot-0"
              />
              <button
                onClick={() => setActivePricingCard(1)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${activePricingCard === 1 ? 'bg-[hsl(18,65%,45%)]' : 'bg-[hsl(30,20%,80%)]'}`}
                data-testid="button-pricing-dot-1"
              />
            </div>
            
            {/* Animated Swipe Hint */}
            <motion.div 
              className="flex items-center justify-center gap-1.5 mt-3 text-xs text-[hsl(25,20%,55%)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <motion.span
                animate={{ x: [0, -4, 0, 4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <ChevronLeft className="w-3 h-3" />
              </motion.span>
              <span>Swipe</span>
              <motion.span
                animate={{ x: [0, 4, 0, -4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <ChevronRight className="w-3 h-3" />
              </motion.span>
            </motion.div>
          </div>

          {/* Cloud Subscriptions - Desktop Grid */}
          <div className="hidden md:grid md:grid-cols-2 gap-5 max-w-3xl mx-auto mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
            >
              <div className="h-full p-5 rounded-lg bg-white border border-[hsl(30,20%,85%)] flex flex-col">
                {billingPeriod === 'quarterly' && (
                  <div className="mb-3">
                    <span className="inline-block px-3 py-1 rounded-full bg-[hsl(18,55%,40%)] text-white text-xs font-medium" data-testid="badge-popular-solo-desktop">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[hsl(30,25%,92%)] flex items-center justify-center">
                    <User className="w-4 h-4 text-[hsl(25,25%,35%)]" />
                  </div>
                  <h3 className="text-xl font-medium text-[hsl(25,30%,12%)]">Solo</h3>
                </div>
                <p className="text-sm text-[hsl(25,20%,45%)] mb-4">Perfect for solo practitioners</p>
                <div className="mb-4 h-12 flex items-baseline">
                  <span className="text-4xl font-medium text-[hsl(25,30%,12%)]">£</span>
                  {prefersReducedMotion ? (
                    <span className="text-4xl font-medium text-[hsl(25,30%,12%)]">{getSoloPrice()}</span>
                  ) : (
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={getSoloPrice()}
                        className="text-4xl font-medium text-[hsl(25,30%,12%)]"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                      >
                        {getSoloPrice()}
                      </motion.span>
                    </AnimatePresence>
                  )}
                  <span className="text-sm text-[hsl(25,20%,45%)] ml-2">/{getBillingLabel()}</span>
                </div>
                {getSoloEffectiveMonthly() && (
                  <p className="text-xs text-[hsl(18,65%,45%)] font-medium mb-4">{getSoloEffectiveMonthly()}</p>
                )}
                <ul className={`space-y-2.5 mb-6 flex-grow text-sm ${!getSoloEffectiveMonthly() ? 'mt-4' : ''}`}>
                  {[
                    'Unlimited recordings',
                    'AI transcription with speaker ID',
                    'Attendance note generation',
                    'AI summaries & action items',
                    'Black Box triple-layer security',
                    'Secure document sharing',
                    'Firm branding on exports',
                    'Google & Outlook calendar sync',
                    'GDPR compliance tools',
                    'Email support',
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-[hsl(18,65%,45%)] flex-shrink-0" />
                      <span className="text-[hsl(25,20%,40%)]">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  onClick={() => handleRequestAccess("pricing_solo")} 
                  variant="outline"
                  className="w-full border-[hsl(30,20%,80%)] text-[hsl(25,25%,25%)] mt-auto" 
                  data-testid="button-solo-signup"
                >
                  Request Access
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="relative h-full p-5 rounded-lg bg-[hsl(18,40%,92%)] border-2 border-[hsl(18,45%,70%)] flex flex-col">
                {billingPeriod === 'quarterly' && (
                  <div className="mb-3">
                    <span className="inline-block px-3 py-1 rounded-full bg-[hsl(18,55%,40%)] text-white text-xs font-medium" data-testid="badge-popular-team-desktop">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[hsl(18,50%,82%)] flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-[hsl(18,65%,40%)]" />
                  </div>
                  <h3 className="text-xl font-medium text-[hsl(25,30%,12%)]">Team</h3>
                </div>
                <p className="text-sm text-[hsl(25,20%,45%)] mb-4">For boutique law firms</p>
                <div className="mb-2 h-12 flex items-baseline">
                  <span className="text-4xl font-medium text-[hsl(25,30%,12%)]">£</span>
                  {prefersReducedMotion ? (
                    <span className="text-4xl font-medium text-[hsl(25,30%,12%)]">{getTeamPrice()}</span>
                  ) : (
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={getTeamPrice()}
                        className="text-4xl font-medium text-[hsl(25,30%,12%)]"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                      >
                        {getTeamPrice()}
                      </motion.span>
                    </AnimatePresence>
                  )}
                  <span className="text-sm text-[hsl(25,20%,45%)] ml-2">/{getBillingLabel()}</span>
                </div>
                {getTeamEffectiveMonthly() && (
                  <p className="text-xs text-[hsl(18,65%,45%)] font-medium mb-2">{getTeamEffectiveMonthly()}</p>
                )}
                <p className={`text-xs text-[hsl(25,20%,45%)] mb-4 ${!getTeamEffectiveMonthly() ? 'mt-0' : ''}`}>2 users included, + £{getSeatPrice()}/{getBillingLabel()} per user</p>
                <ul className="space-y-2.5 mb-6 flex-grow text-sm">
                  {[
                    'Everything in Solo',
                    '2 users included',
                    'Team collaboration',
                    'Case assignment',
                    'Admin dashboard',
                    'Priority support',
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-[hsl(18,65%,45%)] flex-shrink-0" />
                      <span className="text-[hsl(25,20%,35%)]">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  onClick={() => handleRequestAccess("pricing_team")} 
                  className="w-full bg-[hsl(18,70%,42%)] text-white font-medium mt-auto" 
                  data-testid="button-team-signup"
                >
                  Request Access
                </Button>
              </div>
            </motion.div>
          </div>

          <p id="pricing-end" className="text-center text-sm text-[hsl(25,20%,45%)] mb-16">
            All prices exclude VAT. Cancel anytime during your evaluation period.
          </p>

          {/* Professional Services Section */}
          <motion.div
            className="border-t border-[hsl(30,20%,88%)] pt-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center mb-12">
              <span className="text-sm font-medium text-[hsl(18,65%,45%)] uppercase tracking-wider mb-4 block">
                Also Available
              </span>
              <h3 className="text-3xl sm:text-4xl font-normal text-[hsl(25,30%,12%)] mb-4" style={{ fontFamily: "'Lora', Georgia, serif" }}>
                Expert support when you need it
              </h3>
              <p className="text-lg text-[hsl(25,20%,40%)] max-w-2xl mx-auto" style={{ fontFamily: "'Lora', Georgia, serif" }}>
                Optional services to help your firm get the most from LegalNote. Contact us for details.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Implementation Packages */}
              <motion.div
                className="p-6 rounded-xl bg-[hsl(30,25%,96%)] border border-[hsl(30,20%,88%)]"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
                data-testid="card-service-implementation"
              >
                <div className="w-12 h-12 rounded-xl bg-[hsl(25,30%,88%)] flex items-center justify-center mb-4">
                  <FileText className="w-6 h-6 text-[hsl(25,40%,35%)]" />
                </div>
                <h4 className="text-lg font-medium text-[hsl(25,30%,12%)] mb-3">Implementation</h4>
                <ul className="space-y-2 text-sm text-[hsl(25,20%,40%)]">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[hsl(18,65%,45%)] mt-0.5 flex-shrink-0" />
                    <span>Guided onboarding sessions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[hsl(18,65%,45%)] mt-0.5 flex-shrink-0" />
                    <span>Workflow configuration</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[hsl(18,65%,45%)] mt-0.5 flex-shrink-0" />
                    <span>Team setup & permissions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[hsl(18,65%,45%)] mt-0.5 flex-shrink-0" />
                    <span>Integration assistance</span>
                  </li>
                </ul>
              </motion.div>

              {/* Consulting Services */}
              <motion.div
                className="p-6 rounded-xl bg-[hsl(30,25%,96%)] border border-[hsl(30,20%,88%)]"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1 }}
                data-testid="card-service-consulting"
              >
                <div className="w-12 h-12 rounded-xl bg-[hsl(25,30%,88%)] flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-[hsl(25,40%,35%)]" />
                </div>
                <h4 className="text-lg font-medium text-[hsl(25,30%,12%)] mb-3">Consulting</h4>
                <ul className="space-y-2 text-sm text-[hsl(25,20%,40%)]">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[hsl(18,65%,45%)] mt-0.5 flex-shrink-0" />
                    <span>Workflow optimisation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[hsl(18,65%,45%)] mt-0.5 flex-shrink-0" />
                    <span>Compliance review</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[hsl(18,65%,45%)] mt-0.5 flex-shrink-0" />
                    <span>Best practice guidance</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[hsl(18,65%,45%)] mt-0.5 flex-shrink-0" />
                    <span>Custom reporting</span>
                  </li>
                </ul>
              </motion.div>

              {/* Training Workshops */}
              <motion.div
                className="p-6 rounded-xl bg-[hsl(30,25%,96%)] border border-[hsl(30,20%,88%)]"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.2 }}
                data-testid="card-service-training"
              >
                <div className="w-12 h-12 rounded-xl bg-[hsl(25,30%,88%)] flex items-center justify-center mb-4">
                  <ClipboardCheck className="w-6 h-6 text-[hsl(25,40%,35%)]" />
                </div>
                <h4 className="text-lg font-medium text-[hsl(25,30%,12%)] mb-3">Training</h4>
                <ul className="space-y-2 text-sm text-[hsl(25,20%,40%)]">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[hsl(18,65%,45%)] mt-0.5 flex-shrink-0" />
                    <span>Live team workshops</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[hsl(18,65%,45%)] mt-0.5 flex-shrink-0" />
                    <span>Role-specific training</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[hsl(18,65%,45%)] mt-0.5 flex-shrink-0" />
                    <span>Admin & COLP sessions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[hsl(18,65%,45%)] mt-0.5 flex-shrink-0" />
                    <span>Recorded for reference</span>
                  </li>
                </ul>
              </motion.div>

              {/* Advisory Retainers */}
              <motion.div
                className="p-6 rounded-xl bg-[hsl(18,35%,94%)] border border-[hsl(18,30%,82%)]"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.3 }}
                data-testid="card-service-advisory"
              >
                <div className="w-12 h-12 rounded-xl bg-[hsl(18,40%,82%)] flex items-center justify-center mb-4">
                  <Calendar className="w-6 h-6 text-[hsl(18,50%,35%)]" />
                </div>
                <h4 className="text-lg font-medium text-[hsl(25,30%,12%)] mb-3">Advisory Retainer</h4>
                <ul className="space-y-2 text-sm text-[hsl(25,20%,40%)]">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[hsl(18,65%,45%)] mt-0.5 flex-shrink-0" />
                    <span>Dedicated success manager</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[hsl(18,65%,45%)] mt-0.5 flex-shrink-0" />
                    <span>Monthly strategy calls</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[hsl(18,65%,45%)] mt-0.5 flex-shrink-0" />
                    <span>Priority feature requests</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[hsl(18,65%,45%)] mt-0.5 flex-shrink-0" />
                    <span>Quarterly business reviews</span>
                  </li>
                </ul>
              </motion.div>
            </div>

            <div className="text-center mt-12">
              <Button 
                onClick={() => handleRequestAccess("also_available")}
                size="lg"
                className="bg-[hsl(18,70%,42%)] text-white"
                data-testid="button-also-available-cta"
              >
                Request Early Access
              </Button>
              <p className="text-sm text-[hsl(25,20%,45%)] mt-4">
                Professional services can be added to any subscription.
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Differentiation Section - Why LegalNote */}
      <div className="relative bg-[hsl(30,25%,94%)] py-24 border-y border-[hsl(30,20%,85%)]">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-sm font-medium text-[hsl(18,65%,45%)] uppercase tracking-wider mb-4 block">
              Why LegalNote
            </span>
            <h2 className="text-4xl sm:text-5xl font-normal text-[hsl(25,30%,12%)] mb-6" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              Not another note-taking app
            </h2>
            <p className="text-xl text-[hsl(25,20%,40%)] max-w-3xl mx-auto" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              LegalNote is a compliance-first attendance record system built for regulated legal practice—not a generic dictation tool or AI note-taker.
            </p>
          </motion.div>

          {/* Desktop Table View */}
          <motion.div
            className="hidden md:block overflow-hidden rounded-xl border border-[hsl(30,20%,85%)] bg-white"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[hsl(30,20%,88%)]">
                    <th className="text-left p-4 text-[hsl(25,20%,40%)] font-medium text-sm">Dimension</th>
                    <th className="text-left p-4 text-[hsl(25,15%,50%)] font-medium text-sm bg-[hsl(30,15%,96%)]">Typical dictation / note apps</th>
                    <th className="text-left p-4 font-medium text-sm text-[hsl(25,30%,12%)] bg-[hsl(18,40%,90%)]">LegalNote</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {[
                    { 
                      dimension: "Primary output", 
                      generic: "Audio file, raw transcript, or generic summary focused on convenience", 
                      legalnote: "Structured attendance record aligned with legal training and regulatory expectations" 
                    },
                    { 
                      dimension: "Legal domain awareness", 
                      generic: "Little or no awareness of legal duties, SRA guidance, or evidential standards", 
                      legalnote: "Built around the role of attendance notes in evidencing competent service and defensible decision-making" 
                    },
                    { 
                      dimension: "Point in workflow", 
                      generic: "Used after the fact to \"type up\" notes or dictate for later transcription", 
                      legalnote: "Operates at the point of instruction, forming the attendance record as the matter unfolds" 
                    },
                    { 
                      dimension: "Treatment of actions", 
                      generic: "Actions are buried in text or left to the user to extract manually", 
                      legalnote: "Decisions and next steps are identified, surfaced, and diarised while remaining tied to the matter record" 
                    },
                    { 
                      dimension: "Consent and client care", 
                      generic: "Recording and consent left to firm-by-firm improvisation", 
                      legalnote: "Consent-first capture workflows designed for regulated professional environments" 
                    },
                    { 
                      dimension: "Role of practitioner", 
                      generic: "Tool is effectively an audio/typing assistant", 
                      legalnote: "Tool proposes structure; practitioner exercises judgement and signs off the attendance record" 
                    },
                  ].map((row, index) => (
                    <tr key={index} className="border-b border-[hsl(30,15%,90%)] last:border-b-0">
                      <td className="p-4 font-medium text-[hsl(25,25%,20%)] text-sm">{row.dimension}</td>
                      <td className="p-4 text-[hsl(25,15%,50%)] bg-[hsl(30,15%,96%)] text-sm">
                        <div className="flex items-start gap-2">
                          <XCircle className="w-4 h-4 text-[hsl(0,50%,50%)] mt-0.5 flex-shrink-0" />
                          <span>{row.generic}</span>
                        </div>
                      </td>
                      <td className="p-4 text-[hsl(25,25%,25%)] bg-[hsl(18,40%,90%)] text-sm">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[hsl(18,65%,45%)] mt-0.5 flex-shrink-0" />
                          <span>{row.legalnote}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
          
          {/* Mobile Accordion View */}
          <motion.div
            className="md:hidden"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Accordion type="single" collapsible className="space-y-3">
              {[
                { 
                  dimension: "Primary output", 
                  generic: "Audio file, raw transcript, or generic summary focused on convenience", 
                  legalnote: "Structured attendance record aligned with legal training and regulatory expectations" 
                },
                { 
                  dimension: "Legal domain awareness", 
                  generic: "Little or no awareness of legal duties, SRA guidance, or evidential standards", 
                  legalnote: "Built around the role of attendance notes in evidencing competent service and defensible decision-making" 
                },
                { 
                  dimension: "Point in workflow", 
                  generic: "Used after the fact to \"type up\" notes or dictate for later transcription", 
                  legalnote: "Operates at the point of instruction, forming the attendance record as the matter unfolds" 
                },
                { 
                  dimension: "Treatment of actions", 
                  generic: "Actions are buried in text or left to the user to extract manually", 
                  legalnote: "Decisions and next steps are identified, surfaced, and diarised while remaining tied to the matter record" 
                },
                { 
                  dimension: "Consent and client care", 
                  generic: "Recording and consent left to firm-by-firm improvisation", 
                  legalnote: "Consent-first capture workflows designed for regulated professional environments" 
                },
                { 
                  dimension: "Role of practitioner", 
                  generic: "Tool is effectively an audio/typing assistant", 
                  legalnote: "Tool proposes structure; practitioner exercises judgement and signs off the attendance record" 
                },
              ].map((row, index) => (
                <AccordionItem 
                  key={index} 
                  value={`item-${index}`}
                  className="rounded-xl border border-[hsl(30,20%,85%)] bg-white overflow-hidden"
                >
                  <AccordionTrigger className="px-4 py-4 [&:hover]:no-underline">
                    <span className="font-medium text-[hsl(25,25%,20%)] text-left">{row.dimension}</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4">
                    <div className="space-y-4 pt-2">
                      <div className="p-3 bg-[hsl(30,15%,96%)] rounded-lg">
                        <div className="flex items-start gap-2">
                          <XCircle className="w-4 h-4 text-[hsl(0,50%,50%)] mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-[hsl(0,50%,45%)] uppercase tracking-wide mb-1">Typical Apps</p>
                            <p className="text-sm text-[hsl(25,15%,45%)]">{row.generic}</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 bg-[hsl(18,40%,92%)] rounded-lg">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[hsl(18,65%,45%)] mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-[hsl(18,65%,40%)] uppercase tracking-wide mb-1">LegalNote</p>
                            <p className="text-sm text-[hsl(25,25%,25%)]">{row.legalnote}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </div>

      <FinalCTA onRequestAccess={handleRequestAccess} />

      {/* Footer */}
      <footer ref={footerRef} className="relative bg-[hsl(20,30%,10%)] border-t border-[hsl(20,25%,18%)]">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-2">
              <div className="mb-4">
                <Logo variant="wordmark" size="xl" tone="dark" />
              </div>
              <p className="text-white/50 mb-6 max-w-sm leading-relaxed">
                A compliance-first attendance record system built for regulated UK legal practice. Contemporaneous records that evidence professional judgement.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60">
                  GDPR Compliant
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60">
                  SRA Aligned
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60">
                  UK Data Centres
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-white mb-4">Product</h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <button 
                    onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                    className="text-white/50 hover:text-white transition-colors"
                    data-testid="link-footer-how-it-works"
                  >
                    How It Works
                  </button>
                </li>
                <li>
                  <Link 
                    href="/features"
                    className="text-white/50 hover:text-white transition-colors"
                    data-testid="link-footer-features"
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <button 
                    onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                    className="text-white/50 hover:text-white transition-colors"
                    data-testid="link-footer-pricing"
                  >
                    Pricing
                  </button>
                </li>
                <li>
                  <Link 
                    href="/security"
                    className="text-white/50 hover:text-white transition-colors"
                    data-testid="link-footer-security"
                  >
                    Security
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Contact</h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <a 
                    href="mailto:hello@legalnote.ai" 
                    className="flex items-center gap-2 text-white/50 hover:text-white transition-colors"
                    data-testid="link-footer-email"
                  >
                    <Mail className="w-4 h-4" />
                    hello@legalnote.ai
                  </a>
                </li>
                <li>
                  <a 
                    href="https://www.linkedin.com/company/legalnotehq/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-white/50 hover:text-white transition-colors"
                    data-testid="link-footer-linkedin"
                  >
                    <Linkedin className="w-4 h-4" />
                    LinkedIn
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-white/40">
              © {new Date().getFullYear()} LegalNote AI. All rights reserved.
            </div>
            <div className="flex items-center gap-6 text-sm">
              <Link 
                href="/privacy"
                className="text-white/50 hover:text-white transition-colors"
                data-testid="link-footer-privacy"
              >
                Privacy Policy
              </Link>
              <Link 
                href="/terms"
                className="text-white/50 hover:text-white transition-colors"
                data-testid="link-footer-terms"
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>

      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-[hsl(18,70%,42%)]" />
              Preview Environment
            </DialogTitle>
            <DialogDescription className="text-left pt-2">
              This is a preview environment for demonstration purposes. Login functionality is disabled.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-[hsl(30,30%,96%)] rounded-lg p-4 mt-2">
            <p className="text-sm text-[hsl(25,20%,35%)]">
              To access the full LegalNote platform with all features enabled, please visit our production environment or contact us for a live demonstration.
            </p>
          </div>
          <div className="flex justify-end mt-4">
            <Button 
              onClick={() => setShowPreviewModal(false)}
              className="bg-[hsl(18,70%,42%)] hover:bg-[hsl(18,70%,38%)] text-white"
              data-testid="button-preview-close"
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <EarlyAccessForm 
        open={showEarlyAccessForm} 
        onOpenChange={setShowEarlyAccessForm}
        source={earlyAccessSource}
      />

      <ExploreModal
        isVisible={exploreModal.isVisible}
        onDismiss={exploreModal.dismiss}
        onExplore={() => {
          exploreModal.dismiss();
          handleRequestAccess("scroll_popup");
        }}
      />
    </div>
  );
}
