'use client';

import { Monitor, Moon, Sun } from 'lucide-react';

import { useTheme, type Theme } from '@/components/theme-provider';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';

const OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function ThemeToggle() {
  const { theme, resolved, setTheme } = useTheme();
  const Icon = resolved === 'dark' ? Moon : Sun;

  return (
    <Menu>
      <MenuTrigger
        className="inline-flex size-9 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg"
        aria-label={`Theme: ${theme}`}
      >
        <Icon aria-hidden className="size-4" />
      </MenuTrigger>
      <MenuContent className="w-36">
        {OPTIONS.map((option) => (
          <MenuItem
            key={option.value}
            onSelect={() => setTheme(option.value)}
            className={theme === option.value ? 'text-fg' : undefined}
          >
            <option.icon aria-hidden className="size-3.5" />
            {option.label}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
