/// <reference types="chrome"/>

import { DEBUG } from '../config';

export function debugLog(...args: any[]) {
  if (DEBUG) {
    console.log("[Brightspace Extension]", ...args);
  }
}

export function addDebugOverlay(): HTMLElement | null {
  if (!DEBUG) return null;
  
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.bottom = '10px';
  overlay.style.right = '10px';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  overlay.style.color = 'white';
  overlay.style.padding = '10px';
  overlay.style.borderRadius = '5px';
  overlay.style.zIndex = '9999';
  overlay.style.maxHeight = '200px';
  overlay.style.overflowY = 'auto';
  overlay.style.maxWidth = '400px';
  overlay.id = 'brightspace-extension-debug';
  
  document.body.appendChild(overlay);
  
  return overlay;
}

export function updateDebugOverlay(message: string) {
  if (!DEBUG) return;
  
  let overlay = document.getElementById('brightspace-extension-debug');
  if (!overlay) {
    overlay = addDebugOverlay();
  }
  
  if (!overlay) return;
  
  const entry = document.createElement('div');
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  overlay.appendChild(entry);
  
  // Keep only the last 10 messages
  while (overlay.childNodes.length > 10) {
    const firstChild = overlay.firstChild;
    if (firstChild) {
      overlay.removeChild(firstChild);
    }
  }
}