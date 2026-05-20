/**
 * StepTimerDisplay — Large format elapsed timer for shop floor operators
 * Calculates elapsed time from TimeEntries, excluding paused periods
 */

import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { Timer } from 'lucide-react';
import type { TimeEntry } from '../../types';

interface StepTimerDisplayProps {
  timeEntries: TimeEntry[];
  isRunning: boolean;
}

export const StepTimerDisplay: React.FC<StepTimerDisplayProps> = ({
  timeEntries,
  isRunning,
}) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    function calcElapsed(): number {
      let totalMs = 0;
      let lastStart: number | null = null;

      for (const entry of timeEntries) {
        const ts = entry.timestamp && typeof entry.timestamp === 'object' && 'toMillis' in entry.timestamp
          ? (entry.timestamp as { toMillis: () => number }).toMillis()
          : Date.now();

        switch (entry.action) {
          case 'start':
          case 'resume':
            lastStart = ts;
            break;
          case 'pause':
          case 'complete':
            if (lastStart !== null) {
              totalMs += ts - lastStart;
              lastStart = null;
            }
            break;
        }
      }

      // If still running, add time since last start
      if (lastStart !== null && isRunning) {
        totalMs += Date.now() - lastStart;
      }

      return totalMs;
    }

    setElapsed(calcElapsed());

    if (!isRunning) return;

    const interval = setInterval(() => {
      setElapsed(calcElapsed());
    }, 1000);

    return () => clearInterval(interval);
  }, [timeEntries, isRunning]);

  const hours = Math.floor(elapsed / 3600000);
  const minutes = Math.floor((elapsed % 3600000) / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);

  const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 2,
        borderRadius: 2,
        bgcolor: isRunning ? 'success.50' : 'grey.100',
        border: 1,
        borderColor: isRunning ? 'success.200' : 'grey.300',
      }}
    >
      <Timer
        size={28}
        color={isRunning ? '#2e7d32' : '#9e9e9e'}
      />
      <Typography
        variant="h3"
        fontFamily="monospace"
        fontWeight={700}
        color={isRunning ? 'success.main' : 'text.secondary'}
        sx={{ letterSpacing: 2 }}
      >
        {formatted}
      </Typography>
    </Box>
  );
};
