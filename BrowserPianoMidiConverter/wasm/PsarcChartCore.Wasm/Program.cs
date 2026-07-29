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

            songs.Add(new PsarcSongResult { SongData = songData, Parts = parts });
        }

        return JsonSerializer.Serialize(songs, SerializationUtil.CondensedSerializerOptions);
    }

    // Anonymous types can lose their reflection metadata under the wasm build's IL
    // trimming/linking, which made System.Text.Json silently serialize to "{}" instead
    // of throwing. Named classes are what the linker reliably preserves.
    private class PsarcSongResult
    {
        public SongData SongData { get; set; }
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
