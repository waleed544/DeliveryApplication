import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import api from '../../utils/api';

const assetUrl = (imageUrl) => {
  if (imageUrl?.startsWith('http')) return imageUrl;
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  return `${apiUrl.replace(/\/api\/?$/, '')}${imageUrl}`;
};

export default function BannerSlider({ audience }) {
  const [banners, setBanners] = useState([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    api.get(`/banners/${audience}`).then(response => setBanners(response.data)).catch(() => setBanners([]));
  }, [audience]);

  useEffect(() => {
    if (active >= banners.length) setActive(0);
  }, [active, banners.length]);

  if (!banners.length) return null;

  const move = (direction) => setActive((active + direction + banners.length) % banners.length);

  return (
    <section className="banner-slider relative mb-4 overflow-hidden rounded-2xl shadow-lg" aria-label="العروض والإعلانات">
      <div className="relative aspect-[16/7] min-h-[130px] max-h-[280px] bg-[#05142B]">
        {banners.map((banner, index) => (
          <img
            key={banner.id}
            src={assetUrl(banner.image_url)}
            alt={banner.title || 'إعلان'}
            className={`absolute inset-0 h-full w-full object-contain p-1 transition-opacity duration-700 ${index === active ? 'opacity-100' : 'opacity-0'}`}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
        {banners[active].title && <p className="absolute bottom-3 right-4 left-4 text-sm font-bold text-white drop-shadow-md">{banners[active].title}</p>}
        {banners.length > 1 && <>
          <button type="button" onClick={() => move(-1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm" aria-label="الإعلان السابق"><ChevronRight size={18} /></button>
          <button type="button" onClick={() => move(1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm" aria-label="الإعلان التالي"><ChevronLeft size={18} /></button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {banners.map((banner, index) => <button key={banner.id} type="button" onClick={() => setActive(index)} aria-label={`الإعلان ${index + 1}`} className={`h-1.5 rounded-full transition-all ${index === active ? 'w-5 bg-primary-400' : 'w-1.5 bg-white/70'}`} />)}
          </div>
        </>}
      </div>
    </section>
  );
}

export function BannerEmptyIcon() { return <ImageIcon size={18} />; }
