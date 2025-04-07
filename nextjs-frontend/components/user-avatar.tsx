'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import Image from 'next/image';

interface UserAvatarProps {
  email: string;
  size?: number;
  className?: string;
  image?: string | null;
  name?: string | null;
  showBorder?: boolean; // We'll keep this prop but not use it by default
}

function UserAvatarComponent({
  email,
  size = 40,
  className = '',
  image,
  name,
  showBorder = false, // Default to false
}: UserAvatarProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const getInitials = useCallback((name: string) => {
    return name
      .split(' ')
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, []);

  const getFallbackInitial = useCallback(() => {
    if (name) return getInitials(name);
    if (email) return email.charAt(0).toUpperCase();
    return 'U';
  }, [name, email, getInitials]);

  useEffect(() => {
    let mounted = true;

    const validateImage = async () => {
      if (!mounted) return;

      setIsLoading(true);
      setError(false);

      try {
        // Use Google profile picture if available
        if (image) {
          const cacheKey = `avatar-${email}-${size}`;
          const cachedImage = localStorage.getItem(cacheKey);
          const cacheTimestamp = localStorage.getItem(`${cacheKey}-timestamp`);
          const cacheExpired =
            cacheTimestamp && Date.now() - parseInt(cacheTimestamp) > 86400000; // 24 hours

          if (cachedImage && !cacheExpired) {
            setAvatarUrl(cachedImage);
            setIsLoading(false);
            return;
          }

          // For Google images, trust the URL without checking (reduces unnecessary network requests)
          if (image.includes('googleusercontent.com') && mounted) {
            setAvatarUrl(image);
            localStorage.setItem(cacheKey, image);
            localStorage.setItem(
              `${cacheKey}-timestamp`,
              Date.now().toString(),
            );
            setIsLoading(false);
            return;
          }

          // For other images, check if valid
          const response = await fetch(image, {
            method: 'HEAD',
            cache: 'force-cache',
            next: { revalidate: 86400 }, // Revalidate once per day
          });

          if (response.ok && mounted) {
            setAvatarUrl(image);
            localStorage.setItem(cacheKey, image);
            localStorage.setItem(
              `${cacheKey}-timestamp`,
              Date.now().toString(),
            );
            setIsLoading(false);
            return;
          }
        }

        // Fallback to Vercel avatar
        const vercelAvatarUrl = email
          ? `https://avatar.vercel.sh/${encodeURIComponent(email)}?size=${size}`
          : `https://avatar.vercel.sh/unknown?size=${size}`;

        if (mounted) {
          setAvatarUrl(vercelAvatarUrl);
        }
      } catch (e) {
        console.warn('Error loading avatar:', e);
        if (mounted) {
          setError(true);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    validateImage();

    return () => {
      mounted = false;
    };
  }, [email, image, size]);

  // Remove the border class
  const borderClass = showBorder ? 'ring-1 ring-muted/30' : '';

  if (error || !avatarUrl) {
    return (
      <div
        className={`relative overflow-hidden rounded-full bg-primary/10 flex items-center justify-center text-primary-foreground font-medium ${className}`}
        style={{ width: size, height: size }}
      >
        {getFallbackInitial()}
      </div>
    );
  }

  return (
    <div
      className={`relative ${borderClass}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={avatarUrl}
        alt={`Avatar for ${name || email || 'user'}`}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className} ${
          isLoading ? 'opacity-0' : 'opacity-100'
        } transition-opacity duration-200`}
        onError={() => setError(true)}
        priority={size > 40}
        unoptimized={avatarUrl.includes('googleusercontent.com')}
      />
      {isLoading && (
        <div className="absolute inset-0 bg-muted animate-pulse rounded-full" />
      )}
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
export const UserAvatar = memo(UserAvatarComponent);

UserAvatar.displayName = 'UserAvatar';
