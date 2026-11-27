import React from "react"
import { cn } from "@/lib/utils"

export function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  disabled = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean; variant?: "default" | "ghost" | "outline"; size?: "default" | "sm" | "lg" }) {
  const Comp = asChild ? (React as any).forwardRef((props: any, ref: any) => <a ref={ref} {...props} />) : "button"

  const base = "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
  const variants = {
    default: "bg-white text-[#1C1913] shadow-lg hover:bg-[#EDE6D8]",
    ghost: "bg-white/10 border border-white/15 text-[#F5F2EB] hover:bg-white/20 hover:text-white",
    outline: "border border-[#EDE6D8]/25 text-[#F5F2EB] hover:bg-white/10 hover:text-white",
  }
  const sizes = {
    default: "h-11 px-4 py-2 text-sm",
    sm: "h-9 px-3 text-xs",
    lg: "h-12 px-6 py-3 text-base",
  }

  return (
    <Comp
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled}
      {...(asChild ? {} : { type: "button" })}
      {...props}
    />
  )
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("glass-panel p-6", className)}>{children}</div>
  )
}

export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("flex flex-col space-y-1.5 pb-6", className)}>{children}</div>
}

export function CardTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return <h3 className={cn("text-lg font-semibold text-white tracking-tight", className)}>{children}</h3>
}

export function CardDescription({ className, children }: { className?: string; children: React.ReactNode }) {
  return <p className={cn("text-sm text-slate-400", className)}>{children}</p>
}

export function CardContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("pt-0", className)}>{children}</div>
}

export function Badge({
  className,
  variant = "default",
  children,
}: { className?: string; variant?: "default" | "secondary" | "success" | "warning" | "error"; children: React.ReactNode }) {
  const variants = {
    default: "bg-white/10 border border-white/15 text-[#F5F2EB]",
    secondary: "bg-[#2B261C]/80 border border-[#EDE6D8]/20 text-[#E5DCCA]",
    success: "bg-white/15 border border-white/30 text-white",
    warning: "bg-[#524937]/60 border border-[#D8CFC0]/30 text-[#F5F2EB]",
    error: "bg-[#3D3628]/80 border border-white/25 text-white",
  }
  return (
    <span
      className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider", variants[variant], className)}
    >
      {children}
    </span>
  )
}

export function Input({
  className,
  type = "text",
  placeholder,
  value,
  onChange,
  disabled,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn("glass-input", className)}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
      {...props}
    />
  )
}

export function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return <label className={cn("text-sm font-medium text-slate-300 mb-1.5 block", className)}>{children}</label>
}

export function Separator({ className }: { className?: string }) {
  return <div className={cn("h-px bg-white/10 w-full", className)} />
}

export function Tabs({
  className,
  children,
}: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-wrap gap-1 -mb-px border-b border-white/10", className)}>{children}</div>
  )
}

export function TabsTrigger({
  className,
  active = false,
  children,
}: { className?: string; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center px-3 py-2 text-sm font-medium transition-colors border-b-2",
        active
          ? "border-cyan-500 text-white bg-white/5"
          : "border-transparent text-slate-400 hover:text-white hover:bg-white/5",
        className,
      )}
    >
      {children}
    </button>
  )
}

export function ScrollArea({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("overflow-y-auto no-scrollbar pr-1", className)}>{children}</div>
}
