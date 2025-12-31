'use client';

import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { ChatGreeting } from './ChatGreeting';
import { ChatStyles } from './ChatStyles';

export const ChatOverview = () => {
  const { data: session } = useSession();

  const containerVariants: import('framer-motion').Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: 'easeOut' },
    },
  };

  return (
    <motion.div
      className="w-full md:max-w-3xl mx-auto px-3 sm:px-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="text-center space-y-2 sm:space-y-1.5 my-4 sm:my-3">
        <motion.p
          className="text-primary/60 text-base md:text-base font-medium px-2"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          Your AI Bioinformatics Assistant
        </motion.p>
        <ChatGreeting user={session?.user} />
        <motion.p
          className="text-muted-foreground text-sm sm:text-xs max-w-lg mx-auto leading-tight px-4 sm:px-0"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          Ask me about genomic data, visualizations, or anything below!
        </motion.p>
      </div>
      <ChatStyles />
    </motion.div>
  );
};
