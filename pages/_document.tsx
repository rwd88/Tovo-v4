// pages/_document.tsx
import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en" className="light">
      <Head>
        <meta name="theme-color" content="#ffffff" />
      </Head>
      <body style={{ background: 'white', color: '#000' }}>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
