/**
 * Robust download function med cross-browser support - FORCE DOWNLOAD
 */
export const downloadFile = async (url: string, filename: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // IE11 support
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window.navigator as any)?.msSaveOrOpenBlob) {
        // For IE11, vi må fetch blob først
        fetch(url)
          .then(response => response.blob())
          .then(blob => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window.navigator as any).msSaveOrOpenBlob(blob, filename);
            resolve();
          })
          .catch(reject);
        return;
      }

      // Modern browsers - robuste download
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      
      // Legg til DOM (nødvendig for Firefox)
      document.body.appendChild(link);
      
      // Trigger download med cross-browser event handling
      try {
        // Modern approach
        link.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        }));
      } catch {
        // Fallback for eldre browsere
        const event = document.createEvent('MouseEvents');
        event.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
        link.dispatchEvent(event);
      }
      
      // Cleanup med proper timing
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        // Kun revoke blob URLs (ikke http URLs)
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
        resolve();
      }, 100);
      
    } catch (error) {
      console.error('Download failed:', error);
      reject(error);
    }
  });
};

/**
 * Fallback download via fetch for remote files - FORCE DOWNLOAD
 */
export const downloadViaFetch = async (url: string, filename: string): Promise<void> => {
  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
      mode: 'cors'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const blob = await response.blob();
    
    // IE11 support
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window.navigator as any)?.msSaveOrOpenBlob) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).msSaveOrOpenBlob(blob, filename);
      return;
    }
    
    // For modern browsers: Create blob URL and force download
    const blobUrl = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename; // Force download
    link.style.display = 'none';
    link.setAttribute('download', filename);
    
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 100);
    
  } catch (error) {
    console.error('Fetch download failed:', error);
    // Ultimate fallback: åpne i nytt vindu MEN kun hvis bruker ønsker det
    throw error; // Don't auto-fallback to opening in new tab
  }
};
