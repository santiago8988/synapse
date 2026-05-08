import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0C1324 0%, #1E3A8A 100%)',
        }}
      >
        <svg
          width="380"
          height="380"
          viewBox="-260 -260 520 520"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M -200 -40 C -210 -90, -180 -150, -130 -180 C -70 -210, 10 -218, 80 -200 C 145 -184, 195 -148, 215 -90 C 230 -40, 232 10, 215 60 C 205 95, 180 115, 145 120 C 175 130, 195 155, 195 175 L 100 175 C 90 165, 70 158, 45 158 C 25 158, 5 168, -5 175 L -60 175 C -75 168, -90 152, -100 130 C -115 95, -135 80, -160 70 C -190 55, -210 25, -212 -5 Z"
            fill="#1E3A8A"
            stroke="#5EEAFE"
            strokeWidth="10"
          />
          <path
            d="M -160 50 C -100 35, -20 30, 60 40 C 110 48, 150 60, 180 70"
            stroke="#5EEAFE"
            strokeWidth="6"
            fill="none"
            opacity="0.8"
          />
          <path
            d="M 0 -180 C -10 -130, -10 -70, 0 -10"
            stroke="#5EEAFE"
            strokeWidth="6"
            fill="none"
            opacity="0.8"
          />
          <circle cx="-90" cy="-50" r="18" fill="#5EEAFE" />
          <circle cx="60" cy="-60" r="18" fill="#5EEAFE" />
          <circle cx="130" cy="-30" r="16" fill="#5EEAFE" />
        </svg>
      </div>
    ),
    { ...size },
  )
}
