import { useEffect } from 'react';
import Script from 'next/script';

interface KalturaVideoPlayerProps {
  partnerId: number;
  uiConfId: number;
  entryId: string;
  targetId: string;
}

const KalturaVideoPlayer: React.FC<KalturaVideoPlayerProps> = ({ partnerId, uiConfId, entryId, targetId }) => {
  
  // This will run after the script is loaded
  const setupPlayer = () => {
    try {
      const kalturaPlayer = (window as any).KalturaPlayer.setup({
        targetId: targetId,
        provider: {
          partnerId: partnerId,
          uiConfId: uiConfId,
        },
        playback: {
          autoplay: true,
        },
      });
      kalturaPlayer.loadMedia({ entryId });
    } catch (e: any) {
      console.error(e.message);
    }
  };

  return (
    <>
      <div id={targetId} style={{ width: '640px', height: '360px' }}></div>
      <Script
        src={`https://cdnapisec.kaltura.com/p/${partnerId}/embedPlaykitJs/uiconf_id/${uiConfId}`}
        strategy="afterInteractive"
        onLoad={setupPlayer}  // Ensures player is set up only after the script is loaded
      />
    </>
  );
};

export default KalturaVideoPlayer;
