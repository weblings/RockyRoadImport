using System;
using System.IO;
using Pfim;

namespace ChartConverter
{
    public static class AlbumArtConverter
    {
        public static (byte[] Pixels, int Width, int Height)? GetAlbumArtRgba(byte[] ddsBytes)
        {
            if (ddsBytes == null || ddsBytes.Length == 0)
                return null;

            using MemoryStream stream = new(ddsBytes);
            using IImage image = Pfimage.FromStream(stream);

            int bytesPerPixel;

            switch (image.Format)
            {
                case ImageFormat.Rgba32:
                    bytesPerPixel = 4;
                    break;
                case ImageFormat.Rgb24:
                    bytesPerPixel = 3;
                    break;
                default:
                    throw new NotSupportedException($"Unsupported album art pixel format: {image.Format}");
            }

            int width = image.Width;
            int height = image.Height;
            byte[] pixels = new byte[width * height * 4];

            // Pfim lays Rgba32/Rgb24 data out to match System.Drawing's Format32bppArgb /
            // Format24bppRgb (see Rocksmith2014PsarcLib's DdsAsset.cs, which feeds this same
            // data straight into a Bitmap with those formats) - both are byte-order B,G,R[,A]
            // in memory, so swap to R,G,B,A here for canvas ImageData, and pack out Stride
            // row padding along the way.
            for (int y = 0; y < height; y++)
            {
                int rowStart = y * image.Stride;
                int outRowStart = y * width * 4;

                for (int x = 0; x < width; x++)
                {
                    int srcOffset = rowStart + x * bytesPerPixel;
                    int dstOffset = outRowStart + x * 4;

                    byte b = image.Data[srcOffset];
                    byte g = image.Data[srcOffset + 1];
                    byte r = image.Data[srcOffset + 2];
                    byte a = bytesPerPixel == 4 ? image.Data[srcOffset + 3] : (byte)255;

                    pixels[dstOffset] = r;
                    pixels[dstOffset + 1] = g;
                    pixels[dstOffset + 2] = b;
                    pixels[dstOffset + 3] = a;
                }
            }

            return (pixels, width, height);
        }
    }
}
