/// <reference types="vite/client" />

declare namespace JSX {
  interface IntrinsicElements {
    webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      src?: string;
      partition?: string;
      nodeintegration?: string;
      disablewebsecurity?: string;
      allowpopups?: string;
      useragent?: string;
      preload?: string;
    };
  }
}

