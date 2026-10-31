import { useEffect } from 'react';

export function scheduleAutoDismiss(setNotice, message, delay = 4000) {
  if (!message) {
    return () => {};
  }

  const timer = setTimeout(() => {
    setNotice('');
  }, delay);

  return () => clearTimeout(timer);
}

export function useAutoDismissNotice(notice, setNotice, delay = 4000) {
  useEffect(() => {
    return scheduleAutoDismiss(setNotice, notice, delay);
  }, [notice, setNotice, delay]);
}
