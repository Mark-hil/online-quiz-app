import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalWidth = document.body.style.width;
    const originalPaddingRight = document.body.style.paddingRight;
    
    if (isOpen) {
      // Store current scroll position
      const scrollY = window.scrollY;
      
      // Lock body scroll but maintain position
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      
      // Add padding to prevent layout shift
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    } else {
      // Restore original styles and scroll position
      const scrollY = document.body.style.top;
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = originalWidth;
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      
      // Restore scroll position
      if (scrollY) {
        const y = parseInt(scrollY || '0', 10) * -1;
        window.scrollTo(0, y);
      }
    }
    
    return () => {
      // Ensure cleanup restores everything
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = originalWidth;
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      
      // Restore scroll position on cleanup
      const scrollY = document.body.style.top;
      if (scrollY) {
        const y = parseInt(scrollY || '0', 10) * -1;
        window.scrollTo(0, y);
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container - using absolute positioning for reliable centering */}
      <div className="relative w-full h-full flex items-center justify-center">
        <div
          className={`${sizeClasses[size]} w-full max-h-[90vh] bg-white shadow-xl rounded-lg transform transition-all overflow-hidden flex flex-col`}
        >
          {/* Sticky Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
            <h3 className="text-xl font-bold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 p-1 rounded-md hover:bg-gray-100"
            >
              <X size={24} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {children}
          </div>

          {/* Sticky Footer */}
          {footer && (
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 flex-shrink-0 bg-gray-50">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
