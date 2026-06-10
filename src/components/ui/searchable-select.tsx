'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export type SearchableSelectOption = {
  value: string;
  label: string;
};

type SearchableSelectProps = {
  options: SearchableSelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Выберите...',
  disabled,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selectedOption = React.useMemo(() => options.find((option) => option.value === value), [options, value]);

  const filteredOptions = React.useMemo(() => searchTerm
    ? options.filter((option) =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options, [options, searchTerm]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (option: SearchableSelectOption) => {
    onChange(option.value);
    setSearchTerm('');
    setIsOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="relative" ref={containerRef}>
      <Input
        ref={inputRef}
        type="text"
        placeholder={selectedOption ? selectedOption.label : placeholder}
        value={isOpen ? searchTerm : (selectedOption ? selectedOption.label : '')}
        onFocus={() => setIsOpen(true)}
        onChange={(e) => setSearchTerm(e.target.value)}
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className="w-full"
      />
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg">
          <div className="max-h-60 overflow-y-auto" style={{ touchAction: 'pan-y' }}>
            <div className="p-1">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <div
                    key={option.value}
                    className={cn(
                      "flex items-center justify-between cursor-pointer p-2 text-sm rounded-md hover:bg-accent",
                    )}
                    onClick={() => handleSelect(option)}
                  >
                    <span>{option.label}</span>
                    {value === option.value && <Check className="h-4 w-4" />}
                  </div>
                ))
              ) : (
                <div className="p-2 text-sm text-center text-muted-foreground">
                  Не найдено
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
