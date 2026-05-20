/**
 * ActiveFilesCard — Post-load compact card showing loaded files with change options
 */

import { useRef } from 'react';
import { MoreHorizontal, FolderOpen, Upload, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/core/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/core/components/ui/tooltip';
import FileTypeIndicator from './FileTypeIndicator';

interface ActiveFilesCardProps {
  modelFileName?: string;
  csvFileName?: string;
  onBrowse: () => void;
  onUploadModel: () => void;
  onUploadCsv: () => void;
}

export default function ActiveFilesCard({
  modelFileName,
  csvFileName,
  onBrowse,
  onUploadModel,
  onUploadCsv,
}: ActiveFilesCardProps) {
  const csvInputRef = useRef<HTMLInputElement>(null);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/60 rounded-lg border text-xs">
        {/* Model file */}
        {modelFileName && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 min-w-0">
                <FileTypeIndicator fileName={modelFileName} iconSize="w-3.5 h-3.5" showBadge={false} />
                <span className="text-foreground truncate max-w-[160px]">{modelFileName}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{modelFileName}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* CSV file */}
        {csvFileName && (
          <>
            <span className="text-muted-foreground">+</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 min-w-0">
                  <FileTypeIndicator fileName={csvFileName} iconSize="w-3.5 h-3.5" showBadge={false} />
                  <span className="text-foreground truncate max-w-[120px]">{csvFileName}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{csvFileName}</p>
              </TooltipContent>
            </Tooltip>
          </>
        )}

        {/* No CSV — inline load button */}
        {!csvFileName && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs ml-1"
            onClick={onUploadCsv}
          >
            <FileSpreadsheet className="w-3 h-3 mr-1" />
            Load CSV
          </Button>
        )}

        <div className="flex-1" />

        {/* Change dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onBrowse}>
              <FolderOpen className="w-3.5 h-3.5 mr-2" />
              Browse Projects
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onUploadModel}>
              <Upload className="w-3.5 h-3.5 mr-2" />
              Upload New Model
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onUploadCsv}>
              <FileSpreadsheet className="w-3.5 h-3.5 mr-2" />
              {csvFileName ? 'Replace CSV' : 'Load CSV'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <input
          ref={csvInputRef}
          type="file"
          accept=".csv"
          className="hidden"
        />
      </div>
    </TooltipProvider>
  );
}
