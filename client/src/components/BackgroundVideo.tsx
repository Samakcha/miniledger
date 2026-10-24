import React, { useState, useEffect, useRef } from 'react';

interface BackgroundVideoProps {
  videoSrc?: string;
  posterSrc?: string;
  overlayOpacity?: number;
}

export const BackgroundVideo: React.FC<BackgroundVideoProps> = ({
  videoSrc = '/videos/finance-doodles-1.mp4',
  posterSrc = '/images/finance-doodles-poster.png',
  overlayOpacity = 0.25,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasError, setHasError] = useState<boolean>(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    // Detect user preference for reduced motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleMotionChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleMotionChange);
    return () => mediaQuery.removeEventListener('change', handleMotionChange);
  }, []);

  useEffect(() => {
    // Attempt playback if reduced motion is disabled and video has not errored
    if (videoRef.current && !prefersReducedMotion && !hasError) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          // Handled gracefully (e.g. if autoplay policies restrict playback)
          console.warn('Background video autoplay restricted or failed:', err);
        });
      }
    }
  }, [prefersReducedMotion, hasError]);

  return (
    <div className="bg-video-container" aria-hidden="true">
      {!prefersReducedMotion && !hasError ? (
        <video
          ref={videoRef}
          className="bg-video-element"
          autoPlay
          muted
          loop
          playsInline
          poster={posterSrc}
          onError={() => setHasError(true)}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      ) : (
        <div
          className="bg-video-poster"
          style={{ backgroundImage: `url(${posterSrc})` }}
        />
      )}
      <div
        className="bg-video-overlay"
        style={{ backgroundColor: `rgba(248, 250, 252, ${overlayOpacity})` }}
      />
    </div>
  );
};

export default BackgroundVideo;
