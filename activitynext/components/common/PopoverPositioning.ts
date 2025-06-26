export const calculatePopoverPosition = (event: React.MouseEvent): { x: number; y: number } => {
  const clickX = event.clientX;
  const clickY = event.clientY;
  const popoverWidth = 384;
  const popoverHeight = 300;
  const offset = 12;
  
  let x = clickX + offset;
  let y = clickY + offset;
  
  if (x + popoverWidth > window.innerWidth) {
    x = clickX - popoverWidth - offset;
  }
  if (y + popoverHeight > window.innerHeight) {
    y = clickY - popoverHeight - offset;
  }
  
  return { x, y };
};