'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { User } from 'next-auth';
import { useSession } from 'next-auth/react';

interface ChatGreetingProps {
  user?: User | null;
}

export const ChatGreeting = ({ user }: ChatGreetingProps) => {
  const { data: session } = useSession();
  const currentUser = user || session?.user;
  const userName = currentUser?.name || 'Friend';
  const [greeting, setGreeting] = useState('Hello'); // Default greeting

  useEffect(() => {
    // Only runs on the client after hydration
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) setGreeting('Good Morning');
    else if (hour >= 12 && hour < 17) setGreeting('Good Afternoon');
    else if (hour >= 17 && hour < 22) setGreeting('Good Evening');
    else if (hour >= 22 || hour < 5) setGreeting('Good Night');
    else setGreeting('Hello');
  }, []); // Empty dependency array ensures it runs once on mount

  const greetingVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.4, ease: 'easeOut' },
    },
    hover: { scale: 1.05, transition: { duration: 0.3 } },
  };

  return (
    <motion.h2
      className="text-xl sm:text-2xl md:text-3xl font-semibold flex flex-wrap xs:flex-nowrap items-center justify-center gap-1 sm:gap-1.5 px-2"
      variants={greetingVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
    >
      <span>{greeting},</span>
      <span className="inline-block">{userName}!</span>
      <span className="inline-flex items-center">
        I'm
        <motion.span
          className="Attma-text font-bold ml-1"
          whileHover={{ scale: 1.1, rotate: 2 }}
          transition={{ duration: 0.3 }}
        >
          Attma
        </motion.span>
      </span>
    </motion.h2>
  );
};
