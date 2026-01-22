import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Scale, FileText, ShieldCheck, Clock, Calendar, Check, Building2, User, ArrowRight, Mail, Linkedin, CheckCircle2, XCircle, FileCheck, ClipboardCheck, Users, Gavel, Mic, FileOutput, Brain, Info } from "lucide-react";
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
    "Commercial Law Specialists",
    "Family & Private Client",
    "Property & Conveyancing",
    "Employment Law Practice",
    "Dispute Resolution",
    "Corporate & M&A",
    "Regulatory & Compliance",
    "Litigation Boutique",
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
            x: [0, -1920],
          }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: "loop",
              duration: 30,
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
  const [sliderPosition, setSliderPosition] = useState(50);
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
      <div className="max-w-5xl mx-auto px-6">
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
          <p className="text-lg text-[hsl(25,20%,40%)]">
            Drag the slider to compare traditional notes with LegalNote output
          </p>
        </motion.div>
        
        <motion.div
          ref={containerRef}
          className="relative rounded-2xl overflow-hidden shadow-2xl border border-[hsl(30,20%,85%)] cursor-ew-resize select-none"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
        >
          {/* Before - Traditional Notes */}
          <div className="relative h-[400px] bg-[hsl(40,30%,95%)]">
            <div className="absolute inset-0 p-8">
              <div className="mb-4">
                <span className="text-xs font-medium text-[hsl(0,50%,50%)] uppercase tracking-wider bg-[hsl(0,50%,95%)] px-3 py-1 rounded-full">
                  Traditional Approach
                </span>
              </div>
              <div className="font-mono text-sm text-[hsl(25,20%,35%)] space-y-3 opacity-80" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                <p className="italic">Meeting with Mrs Thompson re: house sale</p>
                <p>- Discussed price, she wants £450k</p>
                <p>- Mentioned something about fixtures?</p>
                <p>- Need to check re: completion date</p>
                <p>- Husband called during meeting</p>
                <p>- [illegible] about solicitor fees</p>
                <p className="text-[hsl(0,50%,50%)]">* No timestamp</p>
                <p className="text-[hsl(0,50%,50%)]">* No consent record</p>
                <p className="text-[hsl(0,50%,50%)]">* Actions unclear</p>
              </div>
            </div>
          </div>
          
          {/* After - LegalNote Output */}
          <div 
            className="absolute inset-0 h-[400px] bg-white overflow-hidden"
            style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
          >
            <div className="absolute inset-0 p-8">
              <div className="mb-4 flex items-center gap-3">
                <span className="text-xs font-medium text-[hsl(130,50%,35%)] uppercase tracking-wider bg-[hsl(130,50%,95%)] px-3 py-1 rounded-full">
                  LegalNote Output
                </span>
                <Badge className="bg-[hsl(18,70%,42%)] text-white text-xs">Evidential Quality</Badge>
              </div>
              <div className="text-sm text-[hsl(25,25%,20%)] space-y-4">
                <div className="border-l-2 border-[hsl(18,60%,50%)] pl-4">
                  <p className="font-medium">Attendance Note - Property Sale</p>
                  <p className="text-xs text-[hsl(25,15%,50%)]">06 January 2026, 14:32 GMT | Duration: 47 mins</p>
                  <p className="text-xs text-[hsl(130,50%,35%)]">Consent recorded: Verbal, witnessed</p>
                </div>
                <div>
                  <p className="font-medium text-[hsl(25,30%,15%)]">Client Instructions:</p>
                  <p>Mrs Sarah Thompson confirmed asking price of £450,000 for 14 Elm Gardens. Fixtures to include fitted wardrobes (master bedroom) and integrated kitchen appliances.</p>
                </div>
                <div>
                  <p className="font-medium text-[hsl(25,30%,15%)]">Action Items:</p>
                  <ul className="list-disc list-inside text-[hsl(18,60%,40%)]">
                    <li>Confirm target completion: 15 March 2026</li>
                    <li>Send fee estimate by 08 January</li>
                    <li>Draft TA6 property form</li>
                  </ul>
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
            className="absolute top-0 bottom-0 w-1 bg-[hsl(18,70%,42%)] cursor-ew-resize z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(18,70%,42%)] focus-visible:ring-offset-2"
            style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[hsl(18,70%,42%)] shadow-lg flex items-center justify-center">
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
function StatCounter({ value, suffix, label, index }: { value: number; suffix: string; label: string; index: number }) {
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
        {prefersReducedMotion ? value : counter.count}{suffix}
      </div>
      <div className="text-sm text-white/60">{label}</div>
    </motion.div>
  );
}

// Trust badges with floating animation (respects reduced motion)
function TrustBadges() {
  const prefersReducedMotion = useReducedMotion();
  const badges = [
    { icon: ShieldCheck, title: "GDPR Compliant", description: "Full compliance with UK GDPR including data subject rights and processing records." },
    { icon: Gavel, title: "SRA Aligned", description: "Workflows designed to support SRA Standards and Regulations requirements." },
    { icon: Clock, title: "Contemporaneous", description: "Timestamped records created at point of instruction, not reconstructed later." },
    { icon: Users, title: "UK Data Centres", description: "All data stored exclusively in UK-based data centres for regulatory compliance." },
  ];

  return (
    <div className="grid md:grid-cols-4 gap-6">
      {badges.map((item, index) => (
        <motion.div
          key={item.title}
          className="text-center p-6"
          initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.4, delay: prefersReducedMotion ? 0 : index * 0.1 }}
        >
          <motion.div 
            className="relative w-16 h-16 mx-auto mb-4"
            animate={prefersReducedMotion ? {} : {
              y: [0, -6, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: index * 0.5,
              ease: "easeInOut",
            }}
          >
            <div className="absolute inset-0 rounded-xl bg-white border border-[hsl(30,20%,85%)] flex items-center justify-center shadow-lg">
              <item.icon className="w-8 h-8 text-[hsl(18,65%,45%)]" />
            </div>
            {!prefersReducedMotion && (
              <motion.div
                className="absolute -inset-2 rounded-2xl bg-[hsl(18,60%,70%)]"
                style={{ zIndex: -1 }}
                animate={{
                  scale: [1, 1.15, 1],
                  opacity: [0.2, 0.05, 0.2],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  delay: index * 0.5,
                }}
              />
            )}
          </motion.div>
          <h3 className="text-lg font-medium text-[hsl(25,30%,12%)] mb-2">{item.title}</h3>
          <p className="text-sm text-[hsl(25,20%,40%)]">{item.description}</p>
        </motion.div>
      ))}
    </div>
  );
}

// Final CTA with animated background (respects reduced motion)
function FinalCTA({ onRequestAccess }: { onRequestAccess: () => void }) {
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
              onClick={onRequestAccess} 
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
    <div className="flex items-center justify-center gap-4 py-8">
      {steps.map((step, index) => (
        <motion.div
          key={step.label}
          className="flex items-center gap-4"
          initial={prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: prefersReducedMotion ? 0 : index * 0.3, duration: prefersReducedMotion ? 0 : 0.5 }}
        >
          <motion.div
            className="relative"
            animate={prefersReducedMotion ? {} : {
              y: [0, -8, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: index * 0.4,
              ease: "easeInOut",
            }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ backgroundColor: step.color }}
            >
              <step.icon className="w-8 h-8 text-white" />
            </div>
            {!prefersReducedMotion && (
              <motion.div
                className="absolute -inset-1 rounded-2xl opacity-30"
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
          <span className="text-sm font-medium text-[hsl(25,25%,30%)]">{step.label}</span>
          {index < steps.length - 1 && (
            <motion.div
              className="flex items-center"
              initial={prefersReducedMotion ? { scaleX: 1 } : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: prefersReducedMotion ? 0 : index * 0.3 + 0.5, duration: prefersReducedMotion ? 0 : 0.3 }}
            >
              <div className="w-12 h-0.5 bg-gradient-to-r from-[hsl(18,50%,60%)] to-[hsl(25,40%,65%)]" />
              <ArrowRight className="w-4 h-4 text-[hsl(25,40%,55%)]" />
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
  const { scrollY } = useScroll();
  const prefersReducedMotion = useReducedMotion();
  
  // Track scroll for sticky nav blur effect
  useEffect(() => {
    const unsubscribe = scrollY.on("change", (y) => {
      setIsScrolled(y > 50);
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

  const handleRequestAccess = () => {
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
      
      {/* Floating CTA - Fixed at bottom on mobile */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 md:hidden">
        <Button 
          onClick={handleRequestAccess}
          className="bg-[hsl(18,70%,42%)] text-white hover:bg-[hsl(18,70%,38%)] rounded-full px-8 py-6 text-base shadow-2xl"
          data-testid="button-floating-cta"
        >
          Request Early Access
        </Button>
      </div>

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

      {/* Sticky Navigation with Blur */}
      <motion.nav 
        className={`sticky top-0 z-50 transition-all duration-300 ${
          isScrolled 
            ? 'bg-white/80 backdrop-blur-lg shadow-sm border-b border-[hsl(30,20%,90%)]' 
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
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-2 sm:gap-6"
            >
              <Button 
                variant="ghost"
                size="sm"
                onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-[hsl(25,25%,25%)] hover:text-[hsl(18,65%,45%)] font-normal text-sm sm:text-base px-2 sm:px-4"
                data-testid="button-nav-features"
              >
                <span className="hidden sm:inline">How It Works</span>
                <span className="sm:hidden">Features</span>
              </Button>
              <Button 
                variant="ghost"
                size="sm"
                onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-[hsl(25,25%,25%)] hover:text-[hsl(18,65%,45%)] font-normal text-sm sm:text-base px-2 sm:px-4"
                data-testid="button-nav-pricing"
              >
                Pricing
              </Button>
              <Button 
                variant="ghost"
                size="sm"
                className="text-[hsl(25,25%,25%)] hover:text-[hsl(18,65%,45%)] font-normal text-sm sm:text-base px-2 sm:px-4"
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
                className="text-[hsl(25,25%,25%)] hover:text-[hsl(18,65%,45%)] font-normal text-sm sm:text-base px-2 sm:px-4"
                data-testid="button-nav-login"
              >
                Log in
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section - Editorial Style with Animated Background */}
      <div className="relative bg-white overflow-hidden">
        <GradientMesh />
        <div className="relative max-w-7xl mx-auto px-6 pt-8 sm:pt-16 pb-12">
          <motion.div 
            className="max-w-4xl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <motion.h1 
              className="text-[2.75rem] sm:text-6xl lg:text-7xl font-normal text-[hsl(25,30%,12%)] mb-4 leading-[1.1] tracking-tight" 
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
              className="h-8 mb-8"
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
          </motion.div>
          
          {/* Animated document flow */}
          <motion.div
            className="hidden md:block mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            <DocumentFlowAnimation />
          </motion.div>
        </div>

        {/* Hero Image Section with Parallax */}
        <HeroImageParallax />

        {/* Hero Description */}
        <div className="max-w-7xl mx-auto px-6 pb-20">
          <motion.p 
            className="text-lg sm:text-xl text-[hsl(25,20%,40%)] max-w-2xl leading-relaxed" 
            style={{ fontFamily: "'Lora', Georgia, serif" }}
            data-testid="text-app-description"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            Spend less time on admin, and more time on the work only lawyers can do. LegalNote frees you from manual note-taking so you can move faster, and deliver more for your clients.
          </motion.p>
          
          {/* Desktop CTA */}
          <motion.div 
            className="hidden md:block mt-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Button 
              onClick={handleRequestAccess}
              className="bg-[hsl(18,70%,42%)] text-white hover:bg-[hsl(18,70%,38%)] rounded-full px-10 py-6 text-base"
              data-testid="button-get-started"
            >
              Request Early Access
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Trust Logos Marquee */}
      <TrustLogosMarquee />

      {/* Animated Statistics Section */}
      <div className="relative bg-[hsl(20,35%,18%)] py-16 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatCounter value={99} suffix="%" label="Transcription accuracy" index={0} />
            <StatCounter value={85} suffix="%" label="Time saved on notes" index={1} />
            <StatCounter value={500} suffix="+" label="Hours documented" index={2} />
            <StatCounter value={100} suffix="%" label="GDPR compliant" index={3} />
          </div>
        </div>
      </div>

      {/* What LegalNote Does - Value Proposition */}
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
            <p className="text-lg text-[hsl(25,20%,40%)] leading-relaxed max-w-3xl mx-auto" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              LegalNote captures what was said, what was decided, and what must happen next, then forms a reviewable attendance note that preserves reasoning, actions, and instructions for professional finalisation. Records are timestamped, contemporaneous, and aligned with how regulators expect legal work to be evidenced.
            </p>
          </motion.div>
        </div>
      </div>

      {/* How It Works Section - Enhanced with horizontal scroll on mobile */}
      <div id="how-it-works" className="relative py-24 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            className="text-center mb-16"
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
            <h2 className="text-4xl sm:text-5xl font-normal text-[hsl(25,30%,12%)] mb-6" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              Attendance records, formed at source
            </h2>
            <p className="text-xl text-[hsl(25,20%,40%)] max-w-3xl mx-auto" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              LegalNote supports practitioners by capturing client meetings through consent-first workflows designed for UK-regulated legal environments.
            </p>
          </motion.div>

          {/* Mobile horizontal scroll */}
          <div className="md:hidden overflow-x-auto pb-8 -mx-6 px-6 scrollbar-hide">
            <div className="flex gap-6" style={{ width: "max-content" }}>
              {[
                { step: "1", title: "Capture with consent", description: "Built-in consent workflows that explain, obtain, and record client consent to recording." },
                { step: "2", title: "Review and refine", description: "Transcribed and formed into a structured attendance note aligned with SRA expectations." },
                { step: "3", title: "Finalise and evidence", description: "Professional judgement determines what is kept, amended, or removed before finalisation." },
              ].map((item, index) => (
                <motion.div 
                  key={item.step}
                  className="w-72 flex-shrink-0 bg-gradient-to-br from-white to-[hsl(30,20%,96%)] rounded-2xl p-6 shadow-lg border border-[hsl(30,20%,90%)]"
                  initial={{ opacity: 0, x: 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.15 }}
                >
                  <motion.div 
                    className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(18,65%,45%)] to-[hsl(20,60%,40%)] flex items-center justify-center text-xl font-medium text-white mb-4 shadow-md"
                    whileHover={{ scale: 1.1, rotate: 5 }}
                  >
                    {item.step}
                  </motion.div>
                  <h3 className="text-lg font-medium text-[hsl(25,30%,12%)] mb-2">{item.title}</h3>
                  <p className="text-sm text-[hsl(25,20%,40%)] leading-relaxed">{item.description}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Desktop grid with 3D tilt cards */}
          <div className="hidden md:grid md:grid-cols-3 gap-8 lg:gap-12" style={{ perspective: "1000px" }}>
            {[
              { 
                step: "1", 
                title: "Capture with consent", 
                description: "Start with built-in consent workflows that explain, obtain, and record client consent to recording. Works with in-person meetings or import from Zoom, Teams, and Google Meet." 
              },
              { 
                step: "2", 
                title: "Review and refine", 
                description: "Conversations are securely transcribed and formed into a structured attendance note reflecting instructions, advice, decisions, and follow-up actions aligned with SRA expectations." 
              },
              { 
                step: "3", 
                title: "Finalise and evidence", 
                description: "The practitioner remains in control: LegalNote proposes the structure and content, but professional judgement determines what is kept, amended, or removed before the record is finalised." 
              },
            ].map((item, index) => (
              <motion.div 
                key={item.step}
                className="relative"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
              >
                {index > 0 && (
                  <motion.div 
                    className="hidden md:block absolute top-12 -left-6 lg:-left-8"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.2 + 0.3 }}
                  >
                    <ArrowRight className="w-6 h-6 text-[hsl(18,55%,60%)]" />
                  </motion.div>
                )}
                <div className="text-center">
                  <motion.div 
                    className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[hsl(18,65%,45%)] to-[hsl(20,60%,38%)] flex items-center justify-center text-2xl font-medium text-white mx-auto mb-6 shadow-lg"
                    whileHover={{ 
                      scale: 1.05,
                      boxShadow: "0 20px 40px -15px rgba(160, 90, 60, 0.4)",
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    {item.step}
                  </motion.div>
                  <h3 className="text-xl font-medium text-[hsl(25,30%,12%)] mb-4">{item.title}</h3>
                  <p className="text-[hsl(25,20%,40%)] leading-relaxed">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section - Compliance Focus */}
      <div className="relative bg-[hsl(30,25%,94%)] py-24 border-y border-[hsl(30,20%,85%)]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-sm font-medium text-[hsl(18,65%,45%)] uppercase tracking-wider mb-4 block">
              Features
            </span>
            <h2 className="text-4xl sm:text-5xl font-normal text-[hsl(25,30%,12%)] mb-6" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              Decisions don't get lost. Actions don't drift.
            </h2>
            <p className="text-xl text-[hsl(25,20%,40%)] max-w-3xl mx-auto" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              LegalNote identifies decisions, next steps, and responsibilities as they arise in conversation—so they are not buried in a long transcript or forgotten notebook.
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" style={{ perspective: "1000px" }}>
            {[
              { 
                icon: FileCheck, 
                title: "Contemporaneous Records", 
                description: "Attendance records formed at source, not days later. Timestamped and evidential, aligned with SRA expectations for detailed, contemporaneous file notes." 
              },
              { 
                icon: ClipboardCheck, 
                title: "Consent-First Capture", 
                description: "Workflows make it straightforward to explain, obtain, and record client consent to recording—meeting expectations of confidentiality and transparency." 
              },
              { 
                icon: Scale, 
                title: "Professional Control", 
                description: "LegalNote proposes structure and content; the practitioner exercises judgement and signs off the attendance record. AI-assisted, not AI-decided." 
              },
              { 
                icon: Calendar, 
                title: "Actions Surfaced & Diarised", 
                description: "Decisions and next steps are identified, surfaced, and synced to your calendar while remaining linked to the attendance record and matter history." 
              },
              { 
                icon: FileText, 
                title: "Living Matter Record", 
                description: "Instead of static files, LegalNote helps create a living record: what was known, what was agreed, and why specific actions were taken at each stage." 
              },
              { 
                icon: ShieldCheck, 
                title: "Audit-Ready Trail", 
                description: "Reviewable, timestamped attendance notes create a coherent audit trail across the life of a matter. HMAC-SHA256 signatures ensure tamper detection." 
              },
            ].map((feature, index) => (
              <TiltCard key={feature.title}>
                <motion.div
                  initial={{ opacity: 0, y: 30, scale: 0.95 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <div className="group h-full p-8 rounded-xl bg-white/70 backdrop-blur-sm border border-white/50 shadow-lg hover:shadow-xl hover:bg-white/90 transition-all duration-300">
                    <motion.div 
                      className="w-14 h-14 rounded-xl bg-gradient-to-br from-[hsl(18,55%,88%)] to-[hsl(18,60%,80%)] flex items-center justify-center mb-5 shadow-sm"
                      whileHover={{ rotate: [0, -10, 10, 0], transition: { duration: 0.5 } }}
                    >
                      <feature.icon className="w-7 h-7 text-[hsl(18,65%,42%)]" />
                    </motion.div>
                    <h3 className="text-xl font-medium text-[hsl(25,30%,12%)] mb-3">{feature.title}</h3>
                    <p className="text-[hsl(25,20%,40%)] leading-relaxed">{feature.description}</p>
                  </div>
                </motion.div>
              </TiltCard>
            ))}
          </div>
        </div>
      </div>

      {/* Differentiation Section */}
      <div className="relative bg-white py-24">
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

          <motion.div
            className="overflow-hidden rounded-xl border border-[hsl(30,20%,85%)] bg-white"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[hsl(30,20%,88%)]">
                    <th className="text-left p-6 text-[hsl(25,20%,40%)] font-medium">Dimension</th>
                    <th className="text-left p-6 text-[hsl(25,15%,50%)] font-medium bg-[hsl(30,15%,96%)]">Typical dictation / note apps</th>
                    <th className="text-left p-6 font-medium text-[hsl(25,30%,12%)] bg-[hsl(18,40%,90%)]">LegalNote</th>
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
                      <td className="p-6 font-medium text-[hsl(25,25%,20%)]">{row.dimension}</td>
                      <td className="p-6 text-[hsl(25,15%,50%)] bg-[hsl(30,15%,96%)]">
                        <div className="flex items-start gap-2">
                          <XCircle className="w-4 h-4 text-[hsl(0,50%,50%)] mt-0.5 flex-shrink-0" />
                          <span>{row.generic}</span>
                        </div>
                      </td>
                      <td className="p-6 text-[hsl(25,25%,25%)] bg-[hsl(18,40%,90%)]">
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
        </div>
      </div>

      {/* Trust & Compliance Section */}
      <div className="relative bg-[hsl(30,25%,94%)] py-24 border-y border-[hsl(30,20%,85%)]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-sm font-medium text-[hsl(18,65%,45%)] uppercase tracking-wider mb-4 block">
              Security & Compliance
            </span>
            <h2 className="text-4xl sm:text-5xl font-normal text-[hsl(25,30%,12%)] mb-6" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              Built to evidence professional judgement
            </h2>
            <p className="text-xl text-[hsl(25,20%,40%)] max-w-3xl mx-auto" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              Designed around the reality that detailed attendance notes are a core strand of evidencing competent service and defensible decision-making.
            </p>
          </motion.div>

          <TrustBadges />
        </div>
      </div>

      {/* Interactive Comparison Slider */}
      <ComparisonSlider />

      {/* Pricing Section */}
      <div id="pricing" className="relative bg-white py-24">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-sm font-medium text-[hsl(18,65%,45%)] uppercase tracking-wider mb-4 block">
              Pricing
            </span>
            <h2 className="text-4xl sm:text-5xl font-normal text-[hsl(25,30%,12%)] mb-6" style={{ fontFamily: "'Lora', Georgia, serif" }}>Simple, transparent pricing</h2>
            <p className="text-xl text-[hsl(25,20%,40%)] max-w-2xl mx-auto mb-10" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              Choose the plan that fits your practice. All plans include a 14-day professional evaluation.
            </p>
            
            <div className="inline-flex items-center gap-1 p-1 bg-[hsl(30,20%,93%)] border border-[hsl(30,20%,85%)] rounded-xl">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-5 py-3 rounded-lg text-sm font-medium transition-all ${
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
                className={`px-5 py-3 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  billingPeriod === 'quarterly' 
                    ? 'bg-white text-[hsl(25,30%,12%)] shadow-sm' 
                    : 'text-[hsl(25,20%,45%)] hover:text-[hsl(25,25%,25%)]'
                }`}
                data-testid="button-quarterly-billing"
              >
                Quarterly
                <span className={`text-xs px-2 py-0.5 rounded-full ${billingPeriod === 'quarterly' ? 'bg-[hsl(18,70%,42%)] text-white' : 'bg-[hsl(18,45%,88%)] text-[hsl(18,60%,30%)]'}`}>
                  Save 11%
                </span>
              </button>
              <button
                onClick={() => setBillingPeriod('annual')}
                className={`px-5 py-3 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  billingPeriod === 'annual' 
                    ? 'bg-white text-[hsl(25,30%,12%)] shadow-sm' 
                    : 'text-[hsl(25,20%,45%)] hover:text-[hsl(25,25%,25%)]'
                }`}
                data-testid="button-annual-billing"
              >
                Annual
                <span className={`text-xs px-2 py-0.5 rounded-full ${billingPeriod === 'annual' ? 'bg-[hsl(18,70%,42%)] text-white' : 'bg-[hsl(18,45%,88%)] text-[hsl(18,60%,30%)]'}`}>
                  Save 20%
                </span>
              </button>
            </div>
          </motion.div>

          {/* Cloud Subscriptions */}
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
            >
              <div className="h-full p-8 rounded-xl bg-white border border-[hsl(30,20%,85%)]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-[hsl(30,25%,92%)] flex items-center justify-center">
                    <User className="w-5 h-5 text-[hsl(25,25%,35%)]" />
                  </div>
                  <h3 className="text-2xl font-medium text-[hsl(25,30%,12%)]">Solo</h3>
                </div>
                <p className="text-[hsl(25,20%,45%)] mb-6">Perfect for solo practitioners</p>
                <div className="mb-8 h-16 flex items-baseline">
                  <span className="text-5xl font-medium text-[hsl(25,30%,12%)]">£</span>
                  {prefersReducedMotion ? (
                    <span className="text-5xl font-medium text-[hsl(25,30%,12%)]">{getSoloPrice()}</span>
                  ) : (
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={getSoloPrice()}
                        className="text-5xl font-medium text-[hsl(25,30%,12%)]"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                      >
                        {getSoloPrice()}
                      </motion.span>
                    </AnimatePresence>
                  )}
                  <span className="text-[hsl(25,20%,45%)] ml-2">/{getBillingLabel()}</span>
                </div>
                {getSoloEffectiveMonthly() && (
                  <p className="text-sm text-[hsl(18,65%,45%)] font-medium mb-6">{getSoloEffectiveMonthly()}</p>
                )}
                <ul className={`space-y-4 mb-8 ${!getSoloEffectiveMonthly() ? 'mt-6' : ''}`}>
                  {[
                    'Unlimited recordings',
                    'AI transcription with speaker ID',
                    'Attendance note generation',
                    'AI summaries & action items',
                    'Secure document sharing',
                    'Firm branding on exports',
                    'Google & Outlook calendar sync',
                    'GDPR compliance tools',
                    'Email support',
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-[hsl(18,65%,45%)] flex-shrink-0" />
                      <span className="text-[hsl(25,20%,40%)]">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  onClick={handleRequestAccess} 
                  variant="outline"
                  size="lg"
                  className="w-full border-[hsl(30,20%,80%)] text-[hsl(25,25%,25%)]" 
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
              <div className="relative h-full p-8 rounded-xl bg-[hsl(18,40%,92%)] border-2 border-[hsl(18,45%,70%)]">
                <div className="absolute -top-3 right-8">
                  <span className="px-4 py-1.5 rounded-full bg-[hsl(18,65%,45%)] text-white text-sm font-medium">
                    Most Popular
                  </span>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-[hsl(18,50%,82%)] flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-[hsl(18,65%,40%)]" />
                  </div>
                  <h3 className="text-2xl font-medium text-[hsl(25,30%,12%)]">Team</h3>
                </div>
                <p className="text-[hsl(25,20%,45%)] mb-6">For boutique law firms</p>
                <div className="mb-2 h-16 flex items-baseline">
                  <span className="text-5xl font-medium text-[hsl(25,30%,12%)]">£</span>
                  {prefersReducedMotion ? (
                    <span className="text-5xl font-medium text-[hsl(25,30%,12%)]">{getTeamPrice()}</span>
                  ) : (
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={getTeamPrice()}
                        className="text-5xl font-medium text-[hsl(25,30%,12%)]"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                      >
                        {getTeamPrice()}
                      </motion.span>
                    </AnimatePresence>
                  )}
                  <span className="text-[hsl(25,20%,45%)] ml-2">/{getBillingLabel()}</span>
                </div>
                {getTeamEffectiveMonthly() && (
                  <p className="text-sm text-[hsl(18,65%,45%)] font-medium mb-2">{getTeamEffectiveMonthly()}</p>
                )}
                <p className={`text-sm text-[hsl(25,20%,45%)] mb-6 ${!getTeamEffectiveMonthly() ? 'mt-0' : ''}`}>2 users included, + £{getSeatPrice()}/{getBillingLabel()} per additional user</p>
                <ul className="space-y-4 mb-8">
                  {[
                    'Everything in Solo',
                    '2 users included',
                    'Team collaboration',
                    'Case assignment',
                    'Admin dashboard',
                    'User activity reports',
                    'Audit log exports',
                    'Priority support',
                    'Custom onboarding',
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-[hsl(18,65%,45%)] flex-shrink-0" />
                      <span className="text-[hsl(25,20%,35%)]">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  onClick={handleRequestAccess} 
                  size="lg"
                  className="w-full bg-[hsl(18,70%,42%)] text-white font-medium" 
                  data-testid="button-team-signup"
                >
                  Request Access
                </Button>
              </div>
            </motion.div>
          </div>

          <p className="text-center text-sm text-[hsl(25,20%,45%)] mb-16">
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
                Professional Services
              </span>
              <h3 className="text-3xl sm:text-4xl font-normal text-[hsl(25,30%,12%)] mb-4" style={{ fontFamily: "'Lora', Georgia, serif" }}>
                Expert support for successful adoption
              </h3>
              <p className="text-lg text-[hsl(25,20%,40%)] max-w-2xl mx-auto" style={{ fontFamily: "'Lora', Georgia, serif" }}>
                Optional services to help your firm get the most from LegalNote, from guided implementation to ongoing advisory support.
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
                <h4 className="text-lg font-medium text-[hsl(25,30%,12%)] mb-2">Implementation</h4>
                <p className="text-2xl font-medium text-[hsl(25,30%,12%)] mb-1" data-testid="text-price-implementation">£1,000 - £2,500</p>
                <p className="text-sm text-[hsl(25,20%,45%)] mb-4">One-time</p>
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
                <h4 className="text-lg font-medium text-[hsl(25,30%,12%)] mb-2">Consulting</h4>
                <p className="text-2xl font-medium text-[hsl(25,30%,12%)] mb-1" data-testid="text-price-consulting">£500 - £1,500</p>
                <p className="text-sm text-[hsl(25,20%,45%)] mb-4">Per engagement</p>
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
                <h4 className="text-lg font-medium text-[hsl(25,30%,12%)] mb-2">Training</h4>
                <p className="text-2xl font-medium text-[hsl(25,30%,12%)] mb-1" data-testid="text-price-training">£250 - £1,500</p>
                <p className="text-sm text-[hsl(25,20%,45%)] mb-4">Per session</p>
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
                <h4 className="text-lg font-medium text-[hsl(25,30%,12%)] mb-2">Advisory Retainer</h4>
                <p className="text-2xl font-medium text-[hsl(25,30%,12%)] mb-1" data-testid="text-price-advisory">£500 - £1,000</p>
                <p className="text-sm text-[hsl(25,20%,45%)] mb-4">Per month</p>
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

            <p className="text-center text-sm text-[hsl(25,20%,45%)] mt-8">
              Professional services can be added to any subscription. Contact us to discuss your requirements.
            </p>
          </motion.div>
        </div>
      </div>

      <FinalCTA onRequestAccess={handleRequestAccess} />

      {/* Footer */}
      <footer className="relative bg-[hsl(20,30%,10%)] border-t border-[hsl(20,25%,18%)]">
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
                    data-testid="link-footer-features"
                  >
                    How It Works
                  </button>
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
        source="landing_page"
      />
    </div>
  );
}
