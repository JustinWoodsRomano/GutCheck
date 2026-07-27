import { Html, Head, Main, NextScript } from "next/document";
import { ADS_ENABLED } from "../components/AdSlot";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon-32x32.png" sizes="32x32" type="image/png" />
        <link rel="icon" href="/favicon-16x16.png" sizes="16x16" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=IBM+Plex+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        {/* AdSense's loader is one of the heavier third-party scripts a
            page can carry -- loading it unconditionally while ads are
            disabled (ADS_ENABLED=false) was pure dead weight on every
            single pageview: main-thread time, third-party cookies, and
            an unnecessary network request, for zero benefit. */}
        {ADS_ENABLED && (
          <script
            async
            src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4996587777992774"
            crossOrigin="anonymous"
          ></script>
        )}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-0ZMBW9N7PV"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-0ZMBW9N7PV');`,
          }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
