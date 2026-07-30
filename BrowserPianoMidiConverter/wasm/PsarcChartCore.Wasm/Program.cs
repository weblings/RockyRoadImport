using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices.JavaScript;
using System.Text.Json;
using ChartConverter;
using PsarcUtil;
using SongFormat;

Console.WriteLine("PsarcChartCore.Wasm ready");

public partial class PsarcInterop
{
    /// <summary>
    /// Converts every arrangement in a .psarc file's bytes into OpenSongChart JSON, reusing
    /// PsarcChartCore.PsarcConverter so the output matches the desktop ChartConverter tool
    /// exactly. Mirrors PsarcExporter.ConvertPsarc's grouping: arrangements belonging to the
    /// same song entry share one SongData (parts merged in via AddOrReplacePart, same as the
    /// desktop tool), while each part's note/vocal data comes back keyed by arrangement name.
    /// A single arrangement failing (e.g. missing SNG data) doesn't abort the rest.
    /// </summary>
    [JSExport]
    internal static string ConvertAllPsarc(byte[] psarcBytes)
    {
        using MemoryStream stream = new(psarcBytes);
        PsarcDecoder decoder = new(stream);

        List<PsarcSongResult> songs = new();

        foreach (PsarcSongEntry songEntry in decoder.AllSongs)
        {
            SongData songData = PsarcConverter.GetSongData(songEntry);
            List<PsarcPartResult> parts = new();

            foreach (string arrangementName in songEntry.Arrangements.Keys)
            {
                PsarcPartResult partResult = new() { Name = arrangementName };

                try
                {
                    var result = PsarcConverter.GetInstrumentPart(decoder, songEntry, arrangementName);

                    if (result == null)
                    {
                        partResult.Error = "Could not read SNG data for this arrangement";
                    }
                    else
                    {
                        songData.AddOrReplacePart(result.Value.Part);
                        partResult.Part = result.Value.Part;
                        partResult.Notes = result.Value.Notes;
                        partResult.Vocals = result.Value.Vocals;
                    }
                }
                catch (Exception ex)
                {
                    partResult.Error = ex.Message;
                }

                parts.Add(partResult);
            }

            songs.Add(new PsarcSongResult { SongData = songData, SongKey = songEntry.SongKey, Parts = parts });
        }

        return JsonSerializer.Serialize(songs, SerializationUtil.CondensedSerializerOptions);
    }

    /// <summary>
    /// Decodes a song's album art to a raw RGBA8 pixel buffer, prefixed with width/height so
    /// the caller doesn't need a second call: [width:int32 LE][height:int32 LE][RGBA8 pixels].
    /// Returns an empty array if no album art exists at this size. Decoding stays in C# (reusing
    /// Pfim's DDS block-decompression via PsarcUtil.GetAlbumArtBytes + AlbumArtConverter) since
    /// that part is genuinely risky to hand-port; PNG encoding happens on the JS side via
    /// OffscreenCanvas instead of pulling in System.Drawing, which has no browser-wasm support.
    /// </summary>
    [JSExport]
    internal static byte[] GetAlbumArt(byte[] psarcBytes, string songKey, int size)
    {
        using MemoryStream stream = new(psarcBytes);
        PsarcDecoder decoder = new(stream);

        byte[] ddsBytes = decoder.GetAlbumArtBytes(songKey, size);

        var decoded = AlbumArtConverter.GetAlbumArtRgba(ddsBytes);

        if (decoded == null)
            return Array.Empty<byte>();

        byte[] result = new byte[8 + decoded.Value.Pixels.Length];
        BitConverter.GetBytes(decoded.Value.Width).CopyTo(result, 0);
        BitConverter.GetBytes(decoded.Value.Height).CopyTo(result, 4);
        decoded.Value.Pixels.CopyTo(result, 8);

        return result;
    }

    /// <summary>
    /// Converts a song's Wwise-packaged audio (.wem) to standard .ogg bytes, reusing
    /// BnkExtractor's Ww2ogg packet/codebook reconstruction as-is (pure managed, no changes
    /// needed) via PsarcUtil.GetOggBytes - which skips RevorbSharp's native ogg.dll/vorbis.dll
    /// granule-fixup pass (unavailable under browser-wasm) since Wwise_RIFF_Vorbis.GenerateOgg
    /// now computes accurate granule positions itself. Returns an empty array on failure (e.g.
    /// no audio for this song) rather than throwing, so it doesn't block chart data/album art.
    /// </summary>
    [JSExport]
    internal static byte[] GetOggAudio(byte[] psarcBytes, string songKey)
    {
        try
        {
            using MemoryStream stream = new(psarcBytes);
            PsarcDecoder decoder = new(stream);

            return decoder.GetOggBytes(songKey);
        }
        catch (Exception ex)
        {
            Console.WriteLine("Failed to extract audio: " + ex);
            return Array.Empty<byte>();
        }
    }

    // Anonymous types can lose their reflection metadata under the wasm build's IL
    // trimming/linking, which made System.Text.Json silently serialize to "{}" instead
    // of throwing. Named classes are what the linker reliably preserves.
    private class PsarcSongResult
    {
        public SongData SongData { get; set; }
        public string SongKey { get; set; }
        public List<PsarcPartResult> Parts { get; set; } = new();
    }

    private class PsarcPartResult
    {
        public string Name { get; set; }
        public SongInstrumentPart Part { get; set; }
        public SongInstrumentNotes Notes { get; set; }
        public List<SongVocal> Vocals { get; set; }
        public string Error { get; set; }
    }
}
