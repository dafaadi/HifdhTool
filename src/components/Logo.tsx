import logo from '../assets/faviconhifdhtoolcropped.png';

interface LogoProps {
  onClick?: () => void;
  className?: string;
}

export function Logo({ onClick, className = '' }: LogoProps) {
  return (
    <div 
      className={`logo-container ${className}`} 
      onClick={onClick}
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.5rem',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none'
      }}
    >
      <img 
        src={logo} 
        alt="Hifdh Tool Logo" 
        className="header-logo-img" 
        style={{ height: '1.8rem', width: 'auto' }}
      />
      <span style={{ 
        fontSize: '1.25rem', 
        fontWeight: 700, 
        color: 'var(--primary-color)', 
        letterSpacing: '-0.01em' 
      }}>
        Hifdh Tool
      </span>
    </div>
  );
}
