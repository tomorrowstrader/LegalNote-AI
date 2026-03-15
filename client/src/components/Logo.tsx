import { useState, useEffect } from "react";
import logoIconBlack from "@assets/LegalNote_Logo_-_Black_on_White_1766066417574.png";
import logoIconWhite from "@assets/LegalNote_Logo_-_White_on_Black_1766074833463.png";
import logoWordBlack from "@assets/LegalNote_Word-Logo_-_Black_on_White_1766071272501.png";
import logoWordWhite from "@assets/LegalNote_Word-Logo_-_White_on_Black_1766071272499.png";

interface LogoProps {
  variant?: "icon" | "wordmark" | "full";
  size?: "sm" | "md" | "lg" | "xl";
  tone?: "auto" | "light" | "dark";
  animate?: boolean;
  className?: string;
}

const CONTAINER_SIZES = {
  sm: { w: "w-20", h: "h-6", iconSize: "h-6 w-6" },
  md: { w: "w-28", h: "h-8", iconSize: "h-8 w-8" },
  lg: { w: "w-36", h: "h-10", iconSize: "h-10 w-10" },
  xl: { w: "w-44", h: "h-12", iconSize: "h-12 w-12" },
};

const HEIGHT_CLASSES = {
  sm: "h-6",
  md: "h-8",
  lg: "h-10",
  xl: "h-12",
};

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
      className={`${HEIGHT_CLASSES[size]} w-auto max-w-full ${iconToneClasses[tone]} ${className}`}
      style={{ objectFit: "contain" }}
    />
  );

  const wordmarkElement = (
    <>
      {tone === "dark" ? (
        <img
          src={logoWordWhite}
          alt="LegalNote"
          className={`${HEIGHT_CLASSES[size]} w-auto max-w-full ${className}`}
          style={{ objectFit: "contain" }}
        />
      ) : tone === "light" ? (
        <img
          src={logoWordBlack}
          alt="LegalNote"
          className={`${HEIGHT_CLASSES[size]} w-auto max-w-full ${className}`}
          style={{ objectFit: "contain" }}
        />
      ) : (
        <>
          <img
            src={logoWordBlack}
            alt="LegalNote"
            className={`${HEIGHT_CLASSES[size]} w-auto max-w-full ${className} dark:hidden`}
            style={{ objectFit: "contain" }}
          />
          <img
            src={logoWordWhite}
            alt="LegalNote"
            className={`${HEIGHT_CLASSES[size]} w-auto max-w-full ${className} hidden dark:block`}
            style={{ objectFit: "contain" }}
          />
        </>
      )}
    </>
  );

  if (animate && variant === "wordmark") {
    const { w, h, iconSize } = CONTAINER_SIZES[size];
    return (
      <div className={`relative ${w} ${h} flex-none`}>
        <div
          className={`absolute inset-0 flex items-center transition-opacity duration-1000 ease-in-out ${showIcon ? "opacity-0 pointer-events-none" : "opacity-100"}`}
        >
          <img
            src={tone === "dark" ? logoWordWhite : logoWordBlack}
            alt="LegalNote"
            className={`${h} w-full object-contain object-left`}
          />
        </div>
        <div
          className={`absolute inset-0 flex items-center transition-opacity duration-1000 ease-in-out ${showIcon ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          <img
            src={getIconSrc()}
            alt="LegalNote"
            className={`${iconSize} object-contain`}
          />
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
