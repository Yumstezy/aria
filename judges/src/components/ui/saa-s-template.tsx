// The "SaaS template" from 21st.dev (Ian, Oct 31): a fixed, blurred black nav with centered links, and a hero with
// white type fading down, one big button and a large picture with a glow behind it. Kept as one file the way it came.
// Changes for Aria: the content comes in as props; the announcement pill is left out (Ian: no pills); the glow is a
// CSS gradient instead of the template's image on 21st.dev's CDN; Poppins loads once in index.html.
import React from "react";

// Inline Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "ghost" | "gradient";
  size?: "default" | "sm" | "lg";
  children: React.ReactNode;
}

const baseStyles = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

const variants = {
  default: "bg-white text-black hover:bg-gray-100",
  secondary: "bg-gray-800 text-white hover:bg-gray-700",
  ghost: "hover:bg-gray-800/50 text-white",
  gradient: "bg-gradient-to-b from-white via-white/95 to-white/60 text-black hover:scale-105 active:scale-95",
};

const sizes = {
  default: "h-10 px-4 py-2 text-sm",
  sm: "h-10 px-5 text-sm",
  lg: "h-12 px-8 text-base",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "default", size = "default", className = "", children, ...props }, ref) => (
    <button ref={ref} className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  )
);
Button.displayName = "Button";

// The same look on a link, since every button on this page goes somewhere
export function ButtonLink({ variant = "default", size = "default", className = "", href, children }: {
  variant?: keyof typeof variants; size?: keyof typeof sizes; className?: string; href: string; children: React.ReactNode;
}) {
  return <a href={href} className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}>{children}</a>;
}

// Icons
export const ArrowRight = ({ className = "", size = 16 }: { className?: string; size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const Menu = ({ className = "", size = 24 }: { className?: string; size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="4" x2="20" y1="12" y2="12" />
    <line x1="4" x2="20" y1="6" y2="6" />
    <line x1="4" x2="20" y1="18" y2="18" />
  </svg>
);

const X = ({ className = "", size = 24 }: { className?: string; size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

export type NavLink = { label: string; href: string };

// Navigation Component
export const Navigation = React.memo(({ logo, links, actions }: { logo: React.ReactNode; links: NavLink[]; actions: React.ReactNode }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <header className="fixed top-0 w-full z-50 border-b border-gray-800/50 bg-black/80 backdrop-blur-md">
      <nav className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="text-xl font-semibold text-white">{logo}</div>

          <div className="hidden md:flex items-center justify-center gap-8 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            {links.map((l) => (
              <a key={l.href} href={l.href} className="text-sm text-white/60 hover:text-white transition-colors">{l.label}</a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">{actions}</div>

          <button type="button" className="md:hidden text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden bg-black/95 backdrop-blur-md border-t border-gray-800/50 animate-[slideDown_0.3s_ease-out]">
          <div className="px-6 py-4 flex flex-col gap-4">
            {links.map((l) => (
              <a key={l.href} href={l.href} className="text-sm text-white/60 hover:text-white transition-colors py-2" onClick={() => setMobileMenuOpen(false)}>
                {l.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-4 border-t border-gray-800/50">{actions}</div>
          </div>
        </div>
      )}
    </header>
  );
});
Navigation.displayName = "Navigation";

// Hero Component
export const Hero = React.memo(({ title, sub, cta, children }: {
  title: React.ReactNode; sub: React.ReactNode; cta: React.ReactNode; children: React.ReactNode;
}) => (
  <section className="relative min-h-screen flex flex-col items-center justify-start px-6 pt-32 pb-20 md:pt-40 md:pb-24" style={{ animation: "fadeIn 0.6s ease-out" }}>
    <h1 className="fade-text text-4xl md:text-5xl lg:text-6xl font-medium text-center max-w-3xl px-6 leading-tight mb-6" style={{ letterSpacing: "-0.05em" }}>
      {title}
    </h1>

    <p className="text-sm md:text-base text-center max-w-2xl px-6 mb-10" style={{ color: "#9ca3af" }}>{sub}</p>

    <div className="flex flex-wrap items-center justify-center gap-4 relative z-10 mb-16">{cta}</div>

    <div className="w-full max-w-6xl relative pb-20">
      {/* the glow behind the picture */}
      <div className="absolute left-1/2 w-[90%] h-[70%] pointer-events-none z-0 blur-3xl"
           style={{ top: "-12%", transform: "translateX(-50%)", background: "radial-gradient(ellipse at 50% 40%, rgba(167,139,250,0.35), rgba(110,168,255,0.18) 45%, transparent 72%)" }}
           aria-hidden="true" />
      <div className="relative z-10">{children}</div>
    </div>
  </section>
));
Hero.displayName = "Hero";
