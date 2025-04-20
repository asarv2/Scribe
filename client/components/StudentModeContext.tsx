// StudentModeContext.tsx
import React, { createContext, useContext, useEffect } from 'react';
import { useLocalStorage } from '@mantine/hooks';

interface StudentModeContextType {
  studentMode: boolean;
  setStudentMode: (val: boolean | ((prevState: boolean) => boolean)) => void;
}

const StudentModeContext = createContext<StudentModeContextType | undefined>(undefined);

interface StudentModeProviderProps {
  children: React.ReactNode;
}

export const StudentModeProvider: React.FC<StudentModeProviderProps> = ({ 
  children
}) => {
  const storageKey = `student-mode`;
  
  // Initialize student mode state with localStorage persistence
  const [studentMode, setStudentMode] = useLocalStorage<boolean>({
    key: storageKey,
    defaultValue: false,
    serialize: JSON.stringify,
    deserialize: (str) => {
      try {
        return JSON.parse(str || 'false');
      } catch {
        return false;
      }
    }
  });

  // Memoize the context value
  const memoizedValue = React.useMemo(() => ({
    studentMode, 
    setStudentMode
  }), [studentMode, setStudentMode]);

  return (
    <StudentModeContext.Provider value={memoizedValue}>
      {children}
    </StudentModeContext.Provider>
  );
};

export const useStudentMode = () => {
  const context = useContext(StudentModeContext);
  if (!context) {
    throw new Error('useStudentMode must be used within a StudentModeProvider');
  }
  return context;
};