import { motion } from "framer-motion";
import { Shield, Mic, Users, FileText, PenLine, Lock, ArrowRight } from "lucide-react";

const workflowSteps = [
  {
    id: "consent",
    icon: Shield,
    title: "Consent Captured",
    description: "Documented before anyone speaks",
  },
  {
    id: "recording",
    icon: Mic,
    title: "Meeting Recorded",
    description: "GDPR-compliant capture",
  },
  {
    id: "attribution",
    icon: Users,
    title: "Speaker Attribution",
    description: "Every voice identified",
  },
  {
    id: "evidence",
    icon: FileText,
    title: "Evidence Created",
    description: "Your conversation becomes your record",
  },
  {
    id: "judgment",
    icon: PenLine,
    title: "Your Judgment",
    description: "You shape the final record",
  },
  {
    id: "sealed",
    icon: Lock,
    title: "Cryptographically Sealed",
    description: "Tamper-proof audit trail",
  },
];

export function WorkflowInfographic() {
  return (
    <div className="w-full" data-testid="workflow-infographic">
      {/* Desktop horizontal flow */}
      <div className="hidden lg:block">
        <div className="relative">
          {/* Connecting line */}
          <div className="absolute top-12 left-[8%] right-[8%] h-0.5 bg-gradient-to-r from-[hsl(30,20%,85%)] via-[hsl(18,50%,70%)] to-[hsl(30,20%,85%)]" />
          
          <div className="grid grid-cols-6 gap-4">
            {workflowSteps.map((step, index) => (
              <motion.div
                key={step.id}
                className="relative flex flex-col items-center text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                data-testid={`workflow-step-${step.id}`}
              >
                {/* Icon container */}
                <motion.div 
                  className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-white to-[hsl(30,20%,96%)] border border-[hsl(30,20%,85%)] flex items-center justify-center shadow-sm z-10"
                  whileHover={{ 
                    scale: 1.05,
                    boxShadow: "0 10px 30px -10px rgba(160, 90, 60, 0.25)",
                  }}
                  transition={{ duration: 0.2 }}
                >
                  <step.icon className="w-10 h-10 text-[hsl(18,65%,45%)]" />
                  {step.badge && (
                    <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-[hsl(18,65%,45%)] text-white text-xs font-medium" data-testid={`badge-${step.id}`}>
                      {step.badge}
                    </span>
                  )}
                </motion.div>
                
                {/* Title and description */}
                <h4 className="mt-4 text-sm font-medium text-[hsl(25,30%,12%)]" data-testid={`text-step-title-${step.id}`}>
                  {step.title}
                </h4>
                <p className="mt-1 text-xs text-[hsl(25,20%,45%)] leading-relaxed max-w-[120px]" data-testid={`text-step-desc-${step.id}`}>
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Tablet 2-row layout */}
      <div className="hidden md:block lg:hidden">
        <div className="grid grid-cols-3 gap-6">
          {workflowSteps.map((step, index) => (
            <motion.div
              key={step.id}
              className="relative flex flex-col items-center text-center pt-3 pl-3"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
              data-testid={`workflow-step-tablet-${step.id}`}
            >
              {/* Icon container with step number attached to top-left */}
              <div className="relative w-20 h-20 rounded-xl bg-gradient-to-br from-white to-[hsl(30,20%,96%)] border border-[hsl(30,20%,85%)] flex items-center justify-center shadow-sm">
                {/* Step number */}
                <span className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-[hsl(18,65%,45%)] text-white text-xs font-medium flex items-center justify-center z-20">
                  {index + 1}
                </span>
                <step.icon className="w-8 h-8 text-[hsl(18,65%,45%)]" />
                {step.badge && (
                  <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-[hsl(18,65%,45%)] text-white text-xs font-medium">
                    {step.badge}
                  </span>
                )}
              </div>
              
              <h4 className="mt-3 text-sm font-medium text-[hsl(25,30%,12%)]">
                {step.title}
              </h4>
              <p className="mt-1 text-xs text-[hsl(25,20%,45%)] leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Mobile horizontal scroll */}
      <div className="md:hidden overflow-x-auto pb-4 pt-3 -mx-6 px-6 scrollbar-hide">
        <div className="flex gap-4" style={{ width: "max-content" }}>
          {workflowSteps.map((step, index) => (
            <motion.div
              key={step.id}
              className="relative flex flex-col items-center text-center w-28 flex-shrink-0"
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
              data-testid={`workflow-step-mobile-${step.id}`}
            >
              {/* Step number */}
              <span className="absolute -top-2 left-0 w-5 h-5 rounded-full bg-[hsl(18,65%,45%)] text-white text-[10px] font-medium flex items-center justify-center z-20">
                {index + 1}
              </span>
              
              {/* Icon container */}
              <div className="relative w-16 h-16 rounded-xl bg-gradient-to-br from-white to-[hsl(30,20%,96%)] border border-[hsl(30,20%,85%)] flex items-center justify-center shadow-sm">
                <step.icon className="w-7 h-7 text-[hsl(18,65%,45%)]" />
                {step.badge && (
                  <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-[hsl(18,65%,45%)] text-white text-[9px] font-medium">
                    {step.badge}
                  </span>
                )}
              </div>
              
              <h4 className="mt-2 text-xs font-medium text-[hsl(25,30%,12%)] dark:text-[hsl(30,20%,92%)] leading-tight">
                {step.title}
              </h4>
              <p className="mt-0.5 text-[10px] text-[hsl(25,20%,45%)] dark:text-[hsl(30,15%,75%)] leading-tight">
                {step.description}
              </p>
              
              {/* Arrow to next step */}
              {index < workflowSteps.length - 1 && (
                <div className="absolute top-8 -right-3">
                  <ArrowRight className="w-4 h-4 text-[hsl(18,50%,70%)]" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Compliance tagline */}
      <motion.div 
        className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-[hsl(25,20%,50%)] dark:text-[hsl(30,15%,75%)]"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.6 }}
        data-testid="workflow-compliance-tagline"
      >
        <span className="flex items-center gap-1.5" data-testid="text-compliance-uk-eu">
          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(130,40%,45%)]" />
          UK/EU Data Residency
        </span>
        <span className="flex items-center gap-1.5" data-testid="text-compliance-audio-deletion">
          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(130,40%,45%)]" />
          GDPR-Compliant Auto-Deletion
        </span>
        <span className="flex items-center gap-1.5" data-testid="text-compliance-gdpr">
          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(130,40%,45%)]" />
          GDPR Compliant
        </span>
        <span className="flex items-center gap-1.5" data-testid="text-compliance-privilege">
          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(130,40%,45%)]" />
          Privilege Protected
        </span>
      </motion.div>
    </div>
  );
}
