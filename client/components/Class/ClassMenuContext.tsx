// ClassMenuContext.tsx
import React, { createContext, useContext, useEffect } from 'react';
import { useLocalStorage } from '@mantine/hooks';
import { useRouter, usePathname } from 'next/navigation';
import { menuConfig, MenuSection } from '@/utils/menu/menuConfig';

interface ClassMenuContextType {
  openSections: Record<string, boolean>;
  toggleSection: (sectionLabel: string) => void;
  setOpenSection: (sectionLabel: string, isOpen: boolean) => void;
}

const ClassMenuContext = createContext<ClassMenuContextType | undefined>(undefined);

// Update MENU_SECTIONS to use the config
const MENU_SECTIONS = Object.keys(menuConfig) as MenuSection[];

export const ClassMenuProvider: React.FC<{ classId: string | null; children: React.ReactNode }> = ({ classId, children }) => {
  const pathname = usePathname();
  const storageKey = `class-navbar-sections-${classId}`;
  
  // Initialize with type safety
  const [openSections, setOpenSections] = useLocalStorage<Record<MenuSection, boolean>>({
    key: storageKey,
    defaultValue: Object.fromEntries(
      MENU_SECTIONS.map(section => [section, false])
    ) as Record<MenuSection, boolean>,
    serialize: JSON.stringify,
    deserialize: (str) => {
      try {
        return JSON.parse(str || '{}');
      } catch {
        // If storage is corrupted, return default state
        return Object.fromEntries(
          MENU_SECTIONS.map(section => [section, false])
        );
      }
    }
  });

  // Update the URL-based section opening logic
  useEffect(() => {
    if (!pathname) return;

    // Map sections to their related paths
    const sectionLinks = Object.fromEntries(
      Object.entries(menuConfig).map(([section, config]) => [
        section,
        'links' in config && config.links ? config.links.map(l => l.link) : [config.link]
      ])
    );

    // Only open a section if its path is exactly matched
    for (const [section, paths] of Object.entries(sectionLinks)) {
      const shouldOpen = paths.some(path => pathname?.endsWith(path ?? ''));
      setOpenSection(section as MenuSection, shouldOpen);
    }
  }, [pathname]);

  const setOpenSection = (label: MenuSection, isOpen: boolean) => {
    setOpenSections(prev => ({
      ...prev,
      [label]: isOpen
    }));
  };

  const toggleSection = (label: MenuSection) => {
    setOpenSection(label, !openSections[label]);
  };

  return (
    <ClassMenuContext.Provider value={{ 
      openSections, 
      toggleSection: (sectionLabel: string) => toggleSection(sectionLabel as MenuSection),
      setOpenSection: (sectionLabel: string, isOpen: boolean) => setOpenSection(sectionLabel as MenuSection, isOpen)
    }}>
      {children}
    </ClassMenuContext.Provider>
  );
};

export const useClassMenu = () => {
  const context = useContext(ClassMenuContext);
  if (!context) {
    throw new Error('useClassMenu must be used within a ClassMenuProvider');
  }
  return context;
};
