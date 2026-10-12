'use client';
// SPDX-License-Identifier: MIT

import * as React from 'react';

interface FallbackImageProps {
  src?: string;
  fallbackSrc: string;
  alt: string;
  className?: string;
}

/**
 * Ảnh có ảnh dự phòng: ảnh vi phạm do engine chụp bị xoá khi engine tắt/khởi động lại nên URL cũ trả 404 —
 * lỗi tải ảnh thì chuyển sang ảnh minh hoạ thay vì để ô trống. Đổi `src` thì thử lại từ đầu.
 */
function Inner({ src, fallbackSrc, alt, className }: FallbackImageProps) {
  const [failed, setFailed] = React.useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={failed || !src ? fallbackSrc : src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function FallbackImage(props: FallbackImageProps) {
  return <Inner key={props.src} {...props} />;
}
