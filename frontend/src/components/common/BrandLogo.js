import React from 'react';

const logoUrl = () => {
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  return `${apiUrl.replace(/\/api\/?$/, '')}/uploads/avatars/logo.jpeg`;
};

export default function BrandLogo({ size = 'md', className = '', alt = 'بكليك' }) {
  const sizes = {
    sm: 'h-9 w-9',
    md: 'h-12 w-12',
    lg: 'h-24 w-24',
  };

  return (
    <span className={`brand-logo inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#05142B] shadow-[0_8px_24px_rgba(0,0,0,0.24)] ${sizes[size] || sizes.md} ${className}`}>
      <img src={logoUrl()} alt={alt} className="h-full w-full object-cover" />
    </span>
  );
}
