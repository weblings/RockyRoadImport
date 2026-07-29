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
    /// Lists the arrangements found in a .psarc file's bytes, for populating a picker in the browser UI.
    /// </summary>
    [JSExport]
    internal static string ListArrangements(byte[] psarcBytes)
    {
        using MemoryStream stream = new(psarcBytes);
        PsarcDecoder decoder = new(stream);

        List<ArrangementInfo> result = new();

        foreach (PsarcSongEntry songEntry in decoder.AllSongs)
        {
            foreach (var kvp in songEntry.Arrangements)
            {
                result.Add(new ArrangementInfo
                {
                    Name = kvp.Key,
                    InstrumentType = PsarcConverter.GetInstrumentType(kvp.Value).ToString()
                });
            }
        }

        return JsonSerializer.Serialize(result);
    }

    /// <summary>
    /// Converts one arrangement from a .psarc file's bytes into OpenSongChart JSON
    /// (SongInstrumentPart + SongInstrumentNotes), reusing PsarcChartCore.PsarcConverter
    /// so the output matches the desktop ChartConverter tool exactly.
    /// </summary>
    [JSExport]
    internal static string ConvertPsarc(byte[] psarcBytes, string arrangementName)
    {
        using MemoryStream stream = new(psarcBytes);
        PsarcDecoder decoder = new(stream);

        PsarcSongEntry songEntry = null;

        foreach (PsarcSongEntry entry in decoder.AllSongs)
        {
            if (entry.Arrangements.ContainsKey(arrangementName))
            {
                songEntry = entry;
                break;
            }
        }

        if (songEntry == null)
            throw new ArgumentException($"Arrangement '{arrangementName}' not found in this .psarc file");

        var result = PsarcConverter.GetInstrumentPart(decoder, songEntry, arrangementName);

        if (result == null)
            throw new InvalidOperationException($"Could not read SNG data for arrangement '{arrangementName}'");

        var output = new PsarcConvertResult
        {
            SongData = PsarcConverter.GetSongData(songEntry),
            Part = result.Value.Part,
            Notes = result.Value.Notes,
            Vocals = result.Value.Vocals
        };

        return JsonSerializer.Serialize(output, SerializationUtil.CondensedSerializerOptions);
    }

    private struct ArrangementInfo
    {
        public string Name { get; set; }
        public string InstrumentType { get; set; }
    }

    // Anonymous types can lose their reflection metadata under the wasm build's IL
    // trimming/linking, which made System.Text.Json silently serialize to "{}" instead
    // of throwing. A named class is what the linker reliably preserves.
    private class PsarcConvertResult
    {
        public SongData SongData { get; set; }
        public SongInstrumentPart Part { get; set; }
        public SongInstrumentNotes Notes { get; set; }
        public List<SongVocal> Vocals { get; set; }
    }
}
