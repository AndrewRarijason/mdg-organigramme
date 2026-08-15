'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export function PasswordField({
  id,
  label,
  value,
  onChange,
  minLength = 6,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  minLength?: number;
}) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <input
        type={showPassword ? 'text' : 'password'}
        id={id}
        required
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(value !== '')}
        className="peer w-full px-4 pt-6 pb-2 bg-white border border-slate-300 text-[13px] md:text-sm rounded-xl text-slate-800 placeholder-transparent focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition duration-200 pr-10"
        placeholder=" "
      />
      <label
        htmlFor={id}
        className={`absolute left-4 transition-all duration-200 pointer-events-none ${
          focused || value ? 'top-1 text-xs text-blue-600' : 'top-3.5 text-sm text-slate-500'
        }`}
      >
        {label}
      </label>
      <button
        type="button"
        onClick={() => setShowPassword((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
        aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
      >
        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}