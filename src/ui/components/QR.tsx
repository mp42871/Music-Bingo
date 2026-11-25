import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

export function QR({ text, className, dark = '#000000', light = '#ffffff', size = 256 }: { text: string; className?: string; dark?: string; light?: string; size?: number }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(text, { margin: 1, width: size, color: { dark, light }, errorCorrectionLevel: text.length > 1200 ? 'L' : 'M' })
      .then((u) => live && setSrc(u)).catch(() => live && setSrc(''));
    return () => { live = false; };
  }, [text, dark, light, size]);
  return src ? <img src={src} alt="QR code" className={className} /> : <span className={className} />;
}
