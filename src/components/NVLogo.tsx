/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface NVLogoProps {
  className?: string;
  style?: React.CSSProperties;
  customLogoUrl?: string | null;
}

export const NVLogo: React.FC<NVLogoProps> = ({ 
  className = "h-8 w-auto",
  style,
  customLogoUrl
}) => {
  // Ưu tiên ảnh logo chính thức trong thư mục public, hoặc customLogoUrl nếu có
  const logoSrc = customLogoUrl || '/logo.png';

  return (
    <img
      src={logoSrc}
      alt="NV Apparel Logo"
      className={className}
      style={{ 
        display: 'inline-block', 
        verticalAlign: 'middle', 
        objectFit: 'contain',
        ...style 
      }}
      onError={(e) => {
        // Dự phòng nếu chưa kịp copy file logo.png vào public
        console.warn('Chưa tìm thấy file /logo.png trong thư mục public');
      }}
    />
  );
};