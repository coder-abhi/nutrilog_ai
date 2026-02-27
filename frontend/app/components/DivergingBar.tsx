// components/DivergingBar.jsx
"use client";

const DivergingBar = ({ consumed, burned, passiveBurn }) => {
    const totalBurned = burned + passiveBurn;
    const net = consumed - totalBurned;
    const maxRange = 1000;
    const percentage = Math.min(Math.abs(net) / maxRange * 50, 50);
    const isDeficit = net < 0;
  
    const getStatus = (net) => {
      if (net < -500) return "Deep deficit — fat burn mode 🔥"
      if (net < 0) return "In deficit — on track 💪"
      if (net === 0) return "Perfectly balanced ⚖️"
      if (net < 300) return "Slight surplus — watch it ⚠️"
      return "High surplus — was it worth it? 🚨"
    }
  
    return (
      <div className="w-full p-4">
        {/* Numbers on top */}
        <div className="flex justify-between mb-2 text-sm">
          <span>Consumed: {consumed} kcal</span>
          <span>Burned: {totalBurned} kcal</span>
          <span>Net: {net} kcal</span>
        </div>
  
        {/* Bar */}
        <div className="relative w-full h-6 bg-gray-200 rounded-full">
          <div className="absolute left-1/2 top-0 w-0.5 h-full bg-gray-800 z-10" />
          <div
            className="absolute top-0 h-full rounded-full transition-all duration-500"
            style={{
              width: `${percentage}%`,
              background: isDeficit ? '#3b82f6' : '#ef4444',
              left: isDeficit ? `${50 - percentage}%` : '50%',
            }}
          />
        </div>
  
        {/* Status */}
        <p className="text-center mt-2 font-medium">{getStatus(net)}</p>
      </div>
    );
  };
  
  export default DivergingBar;