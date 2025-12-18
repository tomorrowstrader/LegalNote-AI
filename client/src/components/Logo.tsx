import logoIconBlack from "@assets/LegalNote_Logo_-_Black_on_White_1766066417574.png";
import logoWordBlack from "@assets/LegalNote_Word-Logo_-_Black_on_White_1766066800309.png";

interface LogoProps {
  variant?: "icon" | "wordmark" | "full";
  size?: "sm" | "md" | "lg";
  tone?: "auto" | "light" | "dark";
  className?: string;
}

export default function Logo({ variant = "icon", size = "md", tone = "auto", className = "" }: LogoProps) {
  const sizeClasses = {
    sm: variant === "icon" ? "h-6 w-6" : "h-6",
    md: variant === "icon" ? "h-8 w-8" : "h-8",
    lg: variant === "icon" ? "h-10 w-10" : "h-10",
  };

  const toneClasses = {
    auto: "dark:invert",
    light: "",
    dark: "invert",
  };

  const iconElement = (
    <img
      src={logoIconBlack}
      alt="LegalNote"
      className={`${sizeClasses[size]} ${toneClasses[tone]} ${className}`}
      style={{ objectFit: "contain" }}
    />
  );

  const wordmarkElement = (
    <img
      src={logoWordBlack}
      alt="LegalNote AI"
      className={`${sizeClasses[size]} ${toneClasses[tone]} ${className}`}
      style={{ objectFit: "contain" }}
    />
  );

  if (variant === "icon") {
    return iconElement;
  }

  if (variant === "wordmark") {
    return wordmarkElement;
  }

  return (
    <div className="flex items-center gap-2">
      {iconElement}
      {wordmarkElement}
    </div>
  );
}
