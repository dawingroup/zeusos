/**
 * Footer Component
 * Application footer with copyright and branding
 */

export function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-[#1d1d1f] text-white/60 py-4 mt-auto">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-white/80 font-medium">Zeus Group</span>
            <span className="text-white/40">|</span>
            <span>Cutlist Processor</span>
          </div>
          <div className="text-white/50">
            © {currentYear} Zeus Group. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
