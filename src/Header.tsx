import { useState } from "react";
import { LinkedinLogo, List, XLogo } from "@phosphor-icons/react";
import { Link, useLocation } from "react-router-dom";
import { Modal } from "./shared/components/Modal";
import { ConnectKitButton } from "connectkit";
import { useAccount } from "wagmi";
import { router } from "./main";
import clsx from "clsx";
import { ParagraphIcon } from "./shared/components/ParagraphIcon";
import { analytics } from "./modules/analytics";

type NavKey = "about" | "explore" | "insights" | "parliament";

const primaryNav: { key: NavKey; name: string; link: string }[] = [
  { key: "about", name: "About", link: "/about" },
  { key: "explore", name: "Explore", link: "/" },
  { key: "insights", name: "Insights", link: "/insights" },
  { key: "parliament", name: "Parliament", link: "/parliament" },
];

const secondaryLinks = [
  {
    name: "List Project",
    url: "https://docs.google.com/forms/d/e/1FAIpQLSeznO5mTekWfSuj0Y1F70HQTKGOMf1HT6UVr45OAu_8ST7CuA/viewform",
  },
  {
    name: "Docs",
    url: "https://regen-atlas.gitbook.io/regen-atlas-docs",
  },
  {
    name: "Blog",
    url: "https://paragraph.xyz/@regenatlas",
  },
];

const legalLinks = [
  { name: "Privacy Policy", link: "/privacy-policy" },
  { name: "Imprint", link: "/imprint" },
];

function isActive(pathname: string, link: string): boolean {
  if (link === "/") {
    return (
      pathname === "/" ||
      pathname.startsWith("/assets") ||
      pathname.startsWith("/orgs") ||
      pathname.startsWith("/actions")
    );
  }
  return pathname.startsWith(link);
}

export default (): React.ReactElement => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const location = useLocation();
  const { chain, isConnected: walletConnected } = useAccount();

  return (
    <header
      className={clsx(
        "px-3 md:px-4 z-20 fixed top-0 left-0 w-full",
        "bg-background site-header",
        "h-[60px] lg:h-[36px]"
      )}
    >
      {/* Single row nav */}
      <div className="flex items-center h-[60px] lg:h-[36px]">
        <Link className="hidden md:block" to="/">
          <img
            src="/RA_logo-01.svg"
            alt="logo"
            className="h-[35px] lg:h-[24px]"
          />
        </Link>
        <Link className="block md:hidden h-[32px]" to="/">
          <img src="/RA_logo-02.svg" alt="logo" className="h-[32px]" />
        </Link>

        <nav className="hidden lg:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
          {primaryNav.map((item) => (
            <Link
              key={item.key}
              className={clsx(
                "text-sm font-medium transition-colors",
                isActive(location.pathname, item.link)
                  ? "text-primary-300 font-bold"
                  : "hover:text-primary-300"
              )}
              to={item.link}
              onClick={() => {
                analytics.sendEvent({
                  category: "Link Click",
                  action: item.name,
                  label: "Header Nav",
                });
              }}
            >
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex items-center ml-auto h-full group/wallet">
          {walletConnected && chain && (
            <>
              <div className="flex items-center gap-1.5 px-3 text-[10px] text-gray-400">
                <div
                  className={clsx(
                    "w-1.5 h-1.5 rounded-full",
                    chain.testnet ? "bg-amber-400" : "bg-green-400"
                  )}
                />
                <span>{chain.name}</span>
              </div>
              <div className="w-px h-1/2 bg-gray-400/50 self-center" />
            </>
          )}
          <div className="w-px h-1/2 bg-gray-400/50 group-hover/wallet:bg-gray-400 transition-colors self-center" />
          <ConnectKitButton.Custom>
            {({ isConnected, show, truncatedAddress, ensName }) => (
              <button
                onClick={show}
                className="h-full px-4 text-[11px] font-medium hover:bg-gray-100 transition-colors flex items-center"
              >
                {isConnected
                  ? ensName ?? truncatedAddress
                  : "Connect Wallet"}
              </button>
            )}
          </ConnectKitButton.Custom>
        </div>

        <List
          className="lg:hidden ml-auto"
          onClick={() => setIsModalOpen(true)}
          size={40}
        />
      </div>

      {/* Mobile menu */}
      {isModalOpen && (
        <Modal fullScreen={true} onClose={() => setIsModalOpen(false)}>
          <div className="flex flex-col justify-between h-full">
            <div className="flex flex-col items-center mt-[40px]">
              {primaryNav.map((item) => (
                <div
                  key={item.key}
                  className={clsx(
                    "p-4 text-2xl mb-2 font-semibold",
                    isActive(location.pathname, item.link) &&
                      "text-primary-300"
                  )}
                  onClick={() => {
                    analytics.sendEvent({
                      category: "Link Click",
                      action: item.name,
                      label: "Mobile Menu",
                    });
                    router
                      .navigate(item.link)
                      .then(() => setIsModalOpen(false));
                  }}
                >
                  {item.name}
                </div>
              ))}

              <div className="mt-4">
                {secondaryLinks.map((item) => (
                  <a
                    className="block p-3 text-lg mb-1 text-gray-300 text-center"
                    key={item.name}
                    href={item.url}
                    target="_blank"
                    onClick={() => {
                      analytics.sendEvent({
                        category: "Link Click",
                        action: item.name,
                        label: "Mobile Menu",
                      });
                    }}
                  >
                    {item.name}
                  </a>
                ))}
              </div>
            </div>

            <div className="flex flex-col justify-center items-center pb-12">
              <ConnectKitButton.Custom>
                {({ isConnected, show, truncatedAddress, ensName }) => (
                  <button
                    onClick={show}
                    className="text-base px-6 py-2 rounded-full border border-white/20 font-medium hover:border-primary-300 hover:text-primary-300 transition-colors"
                  >
                    {isConnected
                      ? ensName ?? truncatedAddress
                      : "Connect Wallet"}
                  </button>
                )}
              </ConnectKitButton.Custom>
              <div className="flex pt-6 gap-6 justify-center">
                <a href="https://x.com/theregenatlas" target="_blank">
                  <XLogo size={32} />
                </a>
                <a
                  href="https://www.linkedin.com/company/regen-atlas"
                  target="_blank"
                >
                  <LinkedinLogo size={32} />
                </a>
                <a href="https://paragraph.xyz/@regenatlas" target="_blank">
                  <ParagraphIcon className="w-7 h-7" />
                </a>
              </div>
              <p className="mt-4">&copy; Regen Atlas 2026</p>

              <div className="flex gap-4 mt-2 text-xs text-gray-400">
                {legalLinks.map((item) => (
                  <div
                    key={item.name}
                    className="cursor-pointer hover:text-gray-200"
                    onClick={() => {
                      router
                        .navigate(item.link)
                        .then(() => setIsModalOpen(false));
                    }}
                  >
                    {item.name}
                  </div>
                ))}
              </div>

              <div className="flex flex-col items-center mt-4">
                <img src="/BMWE_de_v3__Web_farbig.svg" width="200" />
                <p className="text-xs text-center">
                  Funded by the Federal Ministry for Economic Affairs and Energy
                  (BMWi) based on a decision of the German Bundestag.
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </header>
  );
};
