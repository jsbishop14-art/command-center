// The touch screen fills the viewport in dark glass, apart from the dashboard chrome. Its own layout
// so the kiosk shows nothing but the two swipe screens (handoff §6; spec §3 "display only").
export const metadata = {
  title: "Command Center — Touch screen",
};

export default function TouchLayout({ children }: { children: React.ReactNode }) {
  return <div className="touch-shell">{children}</div>;
}
