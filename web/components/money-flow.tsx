export function MoneyFlow() {
  return (
    <svg
      viewBox="0 0 420 360"
      width="100%"
      height="100%"
      style={{ maxHeight: 400 }}
      aria-label="Money flow diagram: researcher pays the Kutip agent, which splits USDC to cited authors on Kite chain"
    >
      <defs>
        <linearGradient id="mfLineK" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--kite-500)" stopOpacity="0.15" />
          <stop offset="1" stopColor="var(--kite-500)" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="mfLineE" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--emerald-500)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--emerald-500)" stopOpacity="0.15" />
        </linearGradient>
      </defs>

      <g className="animate-breathe" style={{ transformOrigin: "65px 175px" }}>
        <rect
          x="12"
          y="145"
          width="108"
          height="60"
          rx="10"
          fill="var(--surface)"
          stroke="var(--kite-500)"
          strokeWidth="1.3"
        />
        <text
          x="66"
          y="168"
          textAnchor="middle"
          fontFamily="var(--font-inter)"
          fontSize="11"
          fontWeight="600"
          fill="var(--ink-2)"
        >
          RESEARCHER
        </text>
        <text
          x="66"
          y="190"
          textAnchor="middle"
          fontFamily="var(--font-jetbrains)"
          fontSize="13"
          fontWeight="600"
          fill="var(--kite-700)"
        >
          − 2.00 USDC
        </text>
      </g>

      <g>
        <rect
          x="160"
          y="140"
          width="110"
          height="70"
          rx="10"
          fill="var(--kite-500)"
          stroke="var(--kite-700)"
          strokeWidth="1"
        />
        <text
          x="215"
          y="168"
          textAnchor="middle"
          fontFamily="var(--font-inter-tight)"
          fontSize="14"
          fontWeight="700"
          fill="#fff"
        >
          KUTIP AGENT
        </text>
        <text
          x="215"
          y="188"
          textAnchor="middle"
          fontFamily="var(--font-inter)"
          fontSize="10"
          fontWeight="500"
          fill="rgba(255,255,255,0.75)"
        >
          reads · cites · splits
        </text>
        <text
          x="215"
          y="202"
          textAnchor="middle"
          fontFamily="var(--font-jetbrains)"
          fontSize="9"
          fill="rgba(255,255,255,0.55)"
        >
          chain id 2368
        </text>
      </g>

      {[
        [50, "Chen, M. et al.", "+ 0.80"],
        [160, "Ortega, S.", "+ 0.60"],
        [270, "Patel & Liu", "+ 0.60"]
      ].map(([y, name, amt]) => (
        <g key={name as string}>
          <rect
            x="310"
            y={y as number}
            width="105"
            height="56"
            rx="10"
            fill="var(--emerald-50)"
            stroke="var(--emerald-500)"
            strokeWidth="1"
          />
          <text
            x="362"
            y={(y as number) + 22}
            textAnchor="middle"
            fontFamily="var(--font-newsreader)"
            fontStyle="italic"
            fontSize="12"
            fill="var(--ink)"
          >
            {name as string}
          </text>
          <text
            x="362"
            y={(y as number) + 42}
            textAnchor="middle"
            fontFamily="var(--font-jetbrains)"
            fontSize="12"
            fontWeight="600"
            fill="var(--emerald-700)"
          >
            {amt as string}
          </text>
        </g>
      ))}

      <path
        d="M 120 175 Q 140 175 160 175"
        stroke="url(#mfLineK)"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M 270 165 Q 290 140 310 78"
        stroke="url(#mfLineE)"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M 270 175 Q 290 180 310 188"
        stroke="url(#mfLineE)"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M 270 185 Q 290 220 310 298"
        stroke="url(#mfLineE)"
        strokeWidth="2"
        fill="none"
      />

      <g>
        <circle r="4.5" fill="var(--kite-500)">
          <animateMotion
            dur="3s"
            repeatCount="indefinite"
            path="M 120 175 Q 140 175 160 175"
          />
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            keyTimes="0;0.1;0.9;1"
            dur="3s"
            repeatCount="indefinite"
          />
        </circle>
        {[
          ["M 270 165 Q 290 140 310 78", "0.1s"],
          ["M 270 175 Q 290 180 310 188", "0.5s"],
          ["M 270 185 Q 290 220 310 298", "0.9s"]
        ].map(([path, begin]) => (
          <circle key={path} r="4.5" fill="var(--emerald-500)">
            <animateMotion
              dur="3s"
              begin={begin}
              repeatCount="indefinite"
              path={path}
            />
            <animate
              attributeName="opacity"
              values="0;1;1;0"
              keyTimes="0;0.1;0.9;1"
              dur="3s"
              begin={begin}
              repeatCount="indefinite"
            />
          </circle>
        ))}
      </g>

      <text
        x="210"
        y="340"
        textAnchor="middle"
        fontFamily="var(--font-inter)"
        fontSize="10"
        fontWeight="600"
        letterSpacing="0.12em"
        fill="var(--ink-3)"
      >
        ONE FULL CYCLE · EVERY 12S · LIVE
      </text>
    </svg>
  );
}
