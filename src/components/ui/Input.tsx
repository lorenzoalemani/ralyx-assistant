import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-medium text-muted">
          {label}
        </label>
        <input
          ref={ref}
          id={id}
          className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-foreground placeholder:text-muted/60 outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50"
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = "Input";
