import { useState, useEffect } from "react";
import logoIconBlack from "@assets/LegalNote_Logo_-_Black_on_White_1766066417574.png";
import logoIconWhite from "@assets/LegalNote_Logo_-_White_on_Black_1766074833463.png";
import logoWordBlack from "@assets/LegalNote_Word-Logo_-_Black_on_White_1766071272501.png";
import logoWordWhite from "@assets/LegalNote_Word-Logo_-_White_on_Black_1766071272499.png";

interface LogoProps {
  variant?: "icon" | "wordmark" | "full";
  size?: "sm" | "md" | "lg";
  tone?: "auto" | "light" | "dark";
  animate?: boolean;
  className?: string;
}

export default function Logo({ variant = "icon", size = "md", tone = "auto", animate = false, className = "" }: LogoProps) {
  const [showIcon, setShowIcon] = useState(false);

  useEffect(() => {
    if (animate && variant === "wordmark") {
      const timer = setTimeout(() => {
        setShowIcon(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [animate, variant]);

  const sizeClasses = {
    sm: variant === "icon" || (animate && showIcon) ? "h-6 w-6" : "h-6",
    md: variant === "icon" || (animate && showIcon) ? "h-8 w-8" : "h-8",
    lg: variant === "icon" || (animate && showIcon) ? "h-10 w-10" : "h-10",
  };

  const iconToneClasses = {
    auto: "dark:invert",
    light: "",
    dark: "",
  };

  const getIconSrc = () => {
    if (tone === "dark") return logoIconWhite;
    if (tone === "light") return logoIconBlack;
    return logoIconBlack;
  };

  const iconElement = (
    <img
      src={getIconSrc()}
      alt="LegalNote"
      className={`${sizeClasses[size]} ${iconToneClasses[tone]} ${className}`}
      style={{ objectFit: "contain" }}
    />
  );

  const wordmarkElement = (
    <>
      {tone === "dark" ? (
        <img
          src={logoWordWhite}
          alt="LegalNote AI"
          className={`${sizeClasses[size]} ${className}`}
          style={{ objectFit: "contain" }}
        />
      ) : tone === "light" ? (
        <img
          src={logoWordBlack}
          alt="LegalNote AI"
          className={`${sizeClasses[size]} ${className}`}
          style={{ objectFit: "contain" }}
        />
      ) : (
        <>
          <img
            src={logoWordBlack}
            alt="LegalNote AI"
            className={`${sizeClasses[size]} ${className} dark:hidden`}
            style={{ objectFit: "contain" }}
          />
          <img
            src={logoWordWhite}
            alt="LegalNote AI"
            className={`${sizeClasses[size]} ${className} hidden dark:block`}
            style={{ objectFit: "contain" }}
          />
        </>
      )}
    </>
  );

  if (animate && variant === "wordmark") {
    return (
      <div className="relative">
        <div
          className={`transition-opacity duration-1000 ease-in-out ${showIcon ? "opacity-0" : "opacity-100"}`}
        >
          {wordmarkElement}
        </div>
        <div
          className={`absolute inset-0 flex items-center transition-opacity duration-1000 ease-in-out ${showIcon ? "opacity-100" : "opacity-0"}`}
        >
          {iconElement}
        </div>
      </div>
    );
  }

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
