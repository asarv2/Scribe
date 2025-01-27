/**
 * utils/services/resize.ts
 * Functions to resize
 * @AshokSaravanan222
 * 01/27/2025
 */

export const calculateResizedDimensions = (width: number, height: number, maxSize: number = 1000) => {
    const aspectRatio = width / height;
    let newWidth, newHeight;

    if (width > height) {
        newWidth = maxSize;
        newHeight = Math.round(maxSize / aspectRatio);
    } else {
        newHeight = maxSize;
        newWidth = Math.round(maxSize * aspectRatio);
    }

    return { width: newWidth, height: newHeight };
};