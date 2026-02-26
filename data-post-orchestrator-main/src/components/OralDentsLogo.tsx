interface OralDentsLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'hero';
  className?: string;
}

import logo from '@/assets/oraldents-logo.svg';

const OralDentsLogo = ({ size = 'md', className = '' }: OralDentsLogoProps) => {
  const sizeClasses = {
    sm: 'w-16 h-6',
    md: 'w-24 h-8', 
    lg: 'w-32 h-10',
    xl: 'w-48 h-16',
    xxl: 'w-64 h-20',
    hero: 'w-80 h-24'
  };

  return (
    <img
      src={logo}
      alt="OralDents"
      className={`${sizeClasses[size]} ${className} object-contain`}
      loading="lazy"
    />
  );
};

export default OralDentsLogo;
