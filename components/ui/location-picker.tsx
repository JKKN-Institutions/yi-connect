'use client';

/**
 * Location Picker Component
 *
 * Google Maps integrated location picker with address autocomplete,
 * map preview, and coordinate selection.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, Search, Loader2, Navigation, X, Link2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface LocationPickerProps {
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  onAddressChange: (address: string) => void;
  onCoordinatesChange: (lat: number | null, lng: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    road?: string;
    city?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
}

export function LocationPicker({
  address,
  latitude,
  longitude,
  onAddressChange,
  onCoordinatesChange,
  placeholder = 'Search for a location...',
  disabled = false,
}: LocationPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [googleMapsLink, setGoogleMapsLink] = useState('');
  const [isParsingLink, setIsParsingLink] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search using OpenStreetMap Nominatim API (free, no API key needed)
  const searchLocation = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en',
          },
        }
      );
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Error searching location:', error);
      toast.error('Failed to search location');
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Handle search input with debounce
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchLocation(value);
    }, 500);
  };

  // Get current location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        onCoordinatesChange(lat, lng);

        // Reverse geocode to get address
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
            {
              headers: {
                'Accept-Language': 'en',
              },
            }
          );
          const data = await response.json();
          if (data.display_name) {
            onAddressChange(data.display_name);
          }
          toast.success('Location found!');
        } catch (error) {
          console.error('Error reverse geocoding:', error);
          onAddressChange(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        }
        setIsLocating(false);
        setIsOpen(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        toast.error('Failed to get current location');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Select a search result
  const selectLocation = (result: SearchResult) => {
    onAddressChange(result.display_name);
    onCoordinatesChange(parseFloat(result.lat), parseFloat(result.lon));
    setSearchQuery('');
    setSearchResults([]);
    setIsOpen(false);
    toast.success('Location selected!');
  };

  // Clear location
  const clearLocation = () => {
    onAddressChange('');
    onCoordinatesChange(null, null);
  };

  // Parse Google Maps URL to extract coordinates
  const parseGoogleMapsUrl = (url: string): { lat: number; lng: number } | null => {
    try {
      // Clean the URL - trim whitespace, newlines, and handle encoding
      const cleanUrl = url.trim().replace(/[\n\r\t]/g, '');

      // Try to decode URL-encoded characters (may be encoded multiple times)
      let decodedUrl = cleanUrl;
      for (let i = 0; i < 3; i++) {
        try {
          const decoded = decodeURIComponent(decodedUrl);
          if (decoded === decodedUrl) break;
          decodedUrl = decoded;
        } catch {
          break;
        }
      }

      // Check for short links that can't be parsed directly
      if (/^https?:\/\/(goo\.gl|maps\.app\.goo\.gl)/i.test(cleanUrl)) {
        return null;
      }

      // Helper function to validate and return coordinates
      const validateCoords = (lat: number, lng: number): { lat: number; lng: number } | null => {
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          return { lat, lng };
        }
        return null;
      };

      // Pattern 1: ?q=lat,lng or &q=lat,lng
      const qPattern = /[?&]q=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/;
      const qMatch = decodedUrl.match(qPattern);
      if (qMatch) {
        const result = validateCoords(parseFloat(qMatch[1]), parseFloat(qMatch[2]));
        if (result) return result;
      }

      // Pattern 2: @lat,lng (with various suffixes like ,15z or ,17z)
      const atPattern = /@(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/;
      const atMatch = decodedUrl.match(atPattern);
      if (atMatch) {
        const result = validateCoords(parseFloat(atMatch[1]), parseFloat(atMatch[2]));
        if (result) return result;
      }

      // Pattern 3: !3d{lat}!4d{lng} format (data parameter in URL)
      const embedPattern = /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/;
      const embedMatch = decodedUrl.match(embedPattern);
      if (embedMatch) {
        const result = validateCoords(parseFloat(embedMatch[1]), parseFloat(embedMatch[2]));
        if (result) return result;
      }

      // Pattern 4: ll={lat},{lng} format
      const llPattern = /[?&]ll=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/;
      const llMatch = decodedUrl.match(llPattern);
      if (llMatch) {
        const result = validateCoords(parseFloat(llMatch[1]), parseFloat(llMatch[2]));
        if (result) return result;
      }

      // Pattern 5: center={lat},{lng} format (embed URLs)
      const centerPattern = /[?&]center=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/;
      const centerMatch = decodedUrl.match(centerPattern);
      if (centerMatch) {
        const result = validateCoords(parseFloat(centerMatch[1]), parseFloat(centerMatch[2]));
        if (result) return result;
      }

      // Pattern 6: /place/{lat},{lng} format or /place/Name/@lat,lng
      const placePattern = /\/place\/[^/]*\/@?(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/;
      const placeMatch = decodedUrl.match(placePattern);
      if (placeMatch) {
        const result = validateCoords(parseFloat(placeMatch[1]), parseFloat(placeMatch[2]));
        if (result) return result;
      }

      // Pattern 7: /dir/{start}/{end} format with coordinates
      const dirPattern = /\/dir\/[^/]*\/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/;
      const dirMatch = decodedUrl.match(dirPattern);
      if (dirMatch) {
        const result = validateCoords(parseFloat(dirMatch[1]), parseFloat(dirMatch[2]));
        if (result) return result;
      }

      // Pattern 8: ftid or cid with !8m2!3d{lat}!4d{lng}
      const ftidPattern = /!8m2!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/;
      const ftidMatch = decodedUrl.match(ftidPattern);
      if (ftidMatch) {
        const result = validateCoords(parseFloat(ftidMatch[1]), parseFloat(ftidMatch[2]));
        if (result) return result;
      }

      // Pattern 9: Generic - find any lat,lng pattern with 2+ decimal places
      // Match coordinates like 11.34,77.71 or 11.3410364,77.7171642
      const genericPattern = /(-?\d{1,3}\.\d{2,}),\s*(-?\d{1,3}\.\d{2,})/g;
      const matches = [...decodedUrl.matchAll(genericPattern)];
      if (matches.length > 0) {
        // Try each match and return the first valid one
        for (const match of matches) {
          const lat = parseFloat(match[1]);
          const lng = parseFloat(match[2]);
          const result = validateCoords(lat, lng);
          if (result) {
            return result;
          }
        }
      }

      // Pattern 10: Coordinates separated by %2C (URL-encoded comma)
      const encodedCommaPattern = /(-?\d{1,3}\.\d{2,})%2C\s*(-?\d{1,3}\.\d{2,})/gi;
      const encodedMatches = [...cleanUrl.matchAll(encodedCommaPattern)];
      if (encodedMatches.length > 0) {
        for (const match of encodedMatches) {
          const lat = parseFloat(match[1]);
          const lng = parseFloat(match[2]);
          const result = validateCoords(lat, lng);
          if (result) {
            return result;
          }
        }
      }

      // Pattern 11: Simple space-separated coordinates
      const spacePattern = /(-?\d{1,3}\.\d{2,})\s+(-?\d{1,3}\.\d{2,})/;
      const spaceMatch = decodedUrl.match(spacePattern);
      if (spaceMatch) {
        const result = validateCoords(parseFloat(spaceMatch[1]), parseFloat(spaceMatch[2]));
        if (result) return result;
      }

      return null;
    } catch (error) {
      console.error('Error parsing URL:', error);
      return null;
    }
  };

  // Check if string is a Google Maps URL
  const isGoogleMapsUrl = (text: string): boolean => {
    // Check various Google Maps URL patterns
    const patterns = [
      /google\.com\/maps/i,
      /maps\.google\.com/i,
      /goo\.gl\/maps/i,
      /maps\.app\.goo\.gl/i,
    ];
    return patterns.some(pattern => pattern.test(text));
  };

  // Expand short URL using our server-side API to avoid CORS issues
  const expandShortUrl = async (shortUrl: string): Promise<string | null> => {
    try {
      const response = await fetch('/api/expand-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: shortUrl }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.expandedUrl) {
          return data.expandedUrl;
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to expand short URL:', error);
      return null;
    }
  };

  // Handle pasting Google Maps URL
  const handlePasteGoogleMapsUrl = async (url: string) => {
    const trimmedUrl = url.trim();

    // Check if it looks like a Google Maps URL at all
    if (!isGoogleMapsUrl(trimmedUrl) && !trimmedUrl.includes('google')) {
      toast.error('Please paste a valid Google Maps URL', { duration: 3000 });
      return false;
    }

    setIsParsingLink(true);

    let urlToParse = trimmedUrl;

    // Check for short links and try to expand them
    if (/^https?:\/\/(goo\.gl|maps\.app\.goo\.gl)/i.test(trimmedUrl)) {
      toast.loading('Expanding short link...', { id: 'expand-url' });
      const expandedUrl = await expandShortUrl(trimmedUrl);
      toast.dismiss('expand-url');

      if (expandedUrl) {
        urlToParse = expandedUrl;
      } else {
        // If expansion fails, try to parse the short URL's path for any embedded coordinates
        // or show a helpful message
        setIsParsingLink(false);
        toast.error(
          'Could not expand short link. Please:\n1. Open the link in browser\n2. Copy the full URL from address bar',
          { duration: 5000 }
        );
        return false;
      }
    }

    const coords = parseGoogleMapsUrl(urlToParse);

    if (coords) {
      onCoordinatesChange(coords.lat, coords.lng);

      // Reverse geocode to get address
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&addressdetails=1`,
          {
            headers: {
              'Accept-Language': 'en',
            },
          }
        );
        const data = await response.json();
        if (data.display_name) {
          onAddressChange(data.display_name);
        } else {
          onAddressChange(`${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
        }
      } catch {
        onAddressChange(`${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
      }

      setIsParsingLink(false);
      setGoogleMapsLink('');
      setIsOpen(false);
      toast.success('Location extracted from Google Maps link!');
      return true;
    }

    setIsParsingLink(false);
    toast.error(
      'Could not extract coordinates. Try:\n• Copy URL from browser address bar\n• Or enter coordinates manually below',
      { duration: 5000 }
    );
    return false;
  };

  // Handle address input change - detect Google Maps URLs
  const handleAddressInputChange = async (value: string) => {
    // Check if it's a Google Maps URL
    if (isGoogleMapsUrl(value.trim())) {
      const success = await handlePasteGoogleMapsUrl(value.trim());
      if (success) return;
    }
    // Otherwise just update the address
    onAddressChange(value);
  };

  // Generate Google Maps URL for viewing location
  const getGoogleMapsUrl = () => {
    if (latitude && longitude) {
      return `https://www.google.com/maps?q=${latitude},${longitude}`;
    }
    if (address) {
      return `https://www.google.com/maps/search/${encodeURIComponent(address)}`;
    }
    return null;
  };

  return (
    <div className='space-y-3'>
      {/* Main Input with Dialog Trigger */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <div className='flex gap-2'>
          <div className='relative flex-1'>
            <MapPin className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
            <Input
              value={address}
              onChange={(e) => handleAddressInputChange(e.target.value)}
              placeholder={placeholder}
              disabled={disabled}
              className='pl-10 pr-10'
            />
            {address && (
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7'
                onClick={clearLocation}
              >
                <X className='h-4 w-4' />
              </Button>
            )}
          </div>
          <DialogTrigger asChild>
            <Button type='button' variant='outline' disabled={disabled}>
              <Search className='h-4 w-4 mr-2' />
              Search
            </Button>
          </DialogTrigger>
        </div>

        <DialogContent className='w-[95vw] max-w-[500px] max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Select Location</DialogTitle>
            <DialogDescription>
              Search for an address or use your current location
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 mt-4'>
            {/* Search Input */}
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
              <Input
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder='Search for a place or address...'
                className='pl-10'
                autoFocus
              />
              {isSearching && (
                <Loader2 className='absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground' />
              )}
            </div>

            {/* Current Location Button */}
            <Button
              type='button'
              variant='outline'
              className='w-full'
              onClick={getCurrentLocation}
              disabled={isLocating}
            >
              {isLocating ? (
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
              ) : (
                <Navigation className='h-4 w-4 mr-2' />
              )}
              Use Current Location
            </Button>

            {/* Paste Google Maps Link */}
            <div className='space-y-2'>
              <Label className='text-sm font-medium flex items-center gap-2'>
                <Link2 className='h-4 w-4' />
                Paste Google Maps Link
              </Label>
              <div className='flex gap-2'>
                <Input
                  value={googleMapsLink}
                  onChange={(e) => setGoogleMapsLink(e.target.value)}
                  onPaste={(e) => {
                    // Get pasted text directly from clipboard
                    const pastedText = e.clipboardData.getData('text').trim();
                    if (pastedText && isGoogleMapsUrl(pastedText)) {
                      e.preventDefault();
                      setGoogleMapsLink(pastedText);
                      // Auto-submit after paste
                      setTimeout(() => {
                        handlePasteGoogleMapsUrl(pastedText);
                      }, 100);
                    }
                  }}
                  placeholder='https://www.google.com/maps/...'
                  className='text-sm flex-1'
                />
                <Button
                  type='button'
                  variant='secondary'
                  onClick={() => {
                    if (googleMapsLink.trim()) {
                      handlePasteGoogleMapsUrl(googleMapsLink.trim());
                    }
                  }}
                  disabled={!googleMapsLink.trim() || isParsingLink}
                >
                  {isParsingLink ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : (
                    'Extract'
                  )}
                </Button>
              </div>
              <p className='text-xs text-muted-foreground'>
                Copy a location link from Google Maps and paste it here, then click Extract
              </p>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className='border rounded-lg divide-y max-h-[200px] overflow-y-auto'>
                {searchResults.map((result, index) => (
                  <button
                    key={index}
                    type='button'
                    className='w-full text-left p-3 hover:bg-muted transition-colors'
                    onClick={() => selectLocation(result)}
                  >
                    <div className='flex items-start gap-2'>
                      <MapPin className='h-4 w-4 mt-0.5 text-primary shrink-0' />
                      <div className='flex-1 min-w-0'>
                        <p className='text-sm font-medium truncate'>
                          {result.display_name.split(',')[0]}
                        </p>
                        <p className='text-xs text-muted-foreground truncate'>
                          {result.display_name}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* No Results */}
            {searchQuery.length >= 3 && !isSearching && searchResults.length === 0 && (
              <p className='text-sm text-muted-foreground text-center py-4'>
                No locations found. Try a different search term.
              </p>
            )}

            {/* Selected Location Preview */}
            {(address || (latitude && longitude)) && (
              <div className='border rounded-lg p-3 space-y-3'>
                <div className='flex items-start gap-2'>
                  <MapPin className='h-4 w-4 mt-0.5 text-primary shrink-0' />
                  <div className='flex-1 min-w-0'>
                    <p className='text-sm font-medium'>Selected Location</p>
                    <p className='text-xs text-muted-foreground break-words'>
                      {address || 'No address'}
                    </p>
                    {latitude && longitude && (
                      <p className='text-xs text-muted-foreground mt-1'>
                        Coordinates: {latitude.toFixed(6)}, {longitude.toFixed(6)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Map Preview */}
                {latitude && longitude && (
                  <div className='space-y-2'>
                    <div className='rounded-lg overflow-hidden border'>
                      <iframe
                        src={`https://maps.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`}
                        width='100%'
                        height='150'
                        style={{ border: 0 }}
                        allowFullScreen
                        loading='lazy'
                        referrerPolicy='no-referrer-when-downgrade'
                        title='Map preview'
                      />
                    </div>
                    <a
                      href={getGoogleMapsUrl() || '#'}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-xs text-primary hover:underline flex items-center gap-1'
                    >
                      <MapPin className='h-3 w-3' />
                      View on Google Maps
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Manual Coordinate Entry */}
            <div className='border-t pt-4'>
              <Label className='text-sm font-medium mb-2 block'>
                Or enter coordinates manually:
              </Label>
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <Label className='text-xs text-muted-foreground'>Latitude</Label>
                  <Input
                    type='number'
                    step='any'
                    placeholder='e.g., 11.0168'
                    value={latitude ?? ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseFloat(e.target.value) : null;
                      onCoordinatesChange(val, longitude ?? null);
                    }}
                  />
                </div>
                <div>
                  <Label className='text-xs text-muted-foreground'>Longitude</Label>
                  <Input
                    type='number'
                    step='any'
                    placeholder='e.g., 76.9558'
                    value={longitude ?? ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseFloat(e.target.value) : null;
                      onCoordinatesChange(latitude ?? null, val);
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Close Button */}
            <Button
              type='button'
              className='w-full'
              onClick={() => setIsOpen(false)}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Map Preview & Coordinates Display (below input) */}
      {latitude && longitude && (
        <div className='space-y-2'>
          {/* Map Preview */}
          <div className='rounded-lg overflow-hidden border'>
            <iframe
              src={`https://maps.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`}
              width='100%'
              height='200'
              style={{ border: 0 }}
              allowFullScreen
              loading='lazy'
              referrerPolicy='no-referrer-when-downgrade'
              title='Location map preview'
            />
          </div>
          {/* Coordinates & Link */}
          <div className='flex items-center justify-between'>
            <p className='text-xs text-muted-foreground flex items-center gap-1'>
              <MapPin className='h-3 w-3' />
              {latitude.toFixed(6)}, {longitude.toFixed(6)}
            </p>
            <a
              href={getGoogleMapsUrl() || '#'}
              target='_blank'
              rel='noopener noreferrer'
              className='text-xs text-primary hover:underline flex items-center gap-1'
            >
              View on Google Maps
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
