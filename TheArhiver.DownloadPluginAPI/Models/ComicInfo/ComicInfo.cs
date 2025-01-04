using System.Text;
using System.Xml.Serialization;
using static TheArhiver.DownloadPluginAPI.Models.ComicInfo.ComicEnums;

namespace TheArhiver.DownloadPluginAPI.Models.ComicInfo;

/// <summary>
/// Comic info based off the Anansi Project
/// <see cref="https://anansi-project.github.io/docs/comicinfo/documentation"/>
/// </summary>
[XmlRoot("ComicInfo")]
public class ComicInfo {
    #region XML TheArchiver.Data

    #region Required

    public string Title { get; set; } = string.Empty;
    public string Series { get; set; } = string.Empty;
    public string Number { get; set; } = string.Empty;
    public int Count { get; set; } = -1;
    public int Volume { get; set; } = -1;
    public string AlternateSeries { get; set; } = string.Empty;
    public string AlternateNumber { get; set; } = string.Empty;
    public int AlternateCount { get; set; } = -1;
    public string Summary { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
    public int Year { get; set; } = -1;
    public int Month { get; set; } = -1;
    public int Day { get; set; } = -1;
    public string Writer { get; set; } = string.Empty;
    public string Penciller { get; set; } = string.Empty;
    public string Inker { get; set; } = string.Empty;
    public string Colorist { get; set; } = string.Empty;
    public string Letterer { get; set; } = string.Empty;
    public string CoverArtist { get; set; } = string.Empty;
    public string Editor { get; set; } = string.Empty;
    public string Translator { get; set; } = string.Empty;
    public string Publisher { get; set; } = string.Empty;
    public string Imprint { get; set; } = string.Empty;
    public string Genre { get; set; } = string.Empty;
    public string Tags { get; set; } = string.Empty;
    public string Web { get; set; } = string.Empty;
    public int PageCount { get; set; } = 0;
    public string LanguageISO { get; set; } = string.Empty;
    public string Format { get; set; } = string.Empty;

    #endregion Required

    #region Format

    [XmlElement("BlackAndWhite")] public ComicEnums.YesNo BlackAndWhite { get; set; } = ComicEnums.YesNo.Unknown;
    [XmlElement("Manga")] public ComicEnums.Manga Manga { get; set; } = ComicEnums.Manga.Yes;

    #endregion Format

    #region Series Info

    public string Characters { get; set; } = string.Empty;
    public string MainCharacterOrTeam { get; set; } = string.Empty;
    public string Teams { get; set; } = string.Empty;
    public string Locations { get; set; } = string.Empty;
    public string ScanInformation { get; set; } = string.Empty;
    public string StoryArc { get; set; } = string.Empty;
    public string StoryArcNumber { get; set; } = string.Empty;
    public string SeriesGroup { get; set; } = string.Empty;

    #endregion Series Info

    #region Ratings

    [XmlElement("AgeRating")] public ComicEnums.AgeRating AgeRating { get; set; } = ComicEnums.AgeRating.Unknown;
    [XmlElement("CommunityRating")] public decimal CommunityRating { get; set; }
    public string Review { get; set; } = string.Empty;

    #endregion Ratings

    [XmlElement("Pages")] public List<ComicPageInfo> Pages { get; set; } = new();

    public string GTIN { get; set; } = string.Empty;

    #endregion XML TheArchiver.Data

    #region Methods

    /// <summary>
    /// Saves the ComicInfo object as an XML file to the specified path.
    /// </summary>
    /// <param name="path">The directory path where the ComicInfo.xml file should be saved.</param>
    /// <param name="overwrite">Optional to overwrite the existing</param>
    /// <returns>Returns 0 upon successful save.</returns>
    public int SaveInfo(string path, bool overwrite = false) {
        // Serialize comicInfo as an XML file and save it to D:\Temp
        var serializer = new XmlSerializer(typeof(ComicInfo));
        var filePath = $"{path}{Path.DirectorySeparatorChar}ComicInfo.xml";
        Directory.CreateDirectory(Path.GetDirectoryName(filePath) ?? string.Empty); // Ensure the directory exists
        
        // Delete existing
        if(overwrite && File.Exists(filePath))
            File.Delete(filePath);

        using var stream = new FileStream(filePath, FileMode.Create, FileAccess.Write);
        using var writer = new StreamWriter(stream, Encoding.UTF8);
        serializer.Serialize(writer, this);

        return 0;
    }

    /// <summary>
    /// Loads the ComicInfo object from an XML file located at the specified path.
    /// </summary>
    /// <param name="fileWithPath">The full file path to the ComicInfo.xml file to be loaded.</param>
    /// <returns>Returns 0 upon successful load.</returns>
    /// <exception cref="FileNotFoundException">Thrown if the specified file does not exist at the provided path.</exception>
    public int LoadInfo(string fileWithPath) {
        try {
            // Deserialize the ComicInfo from an XML file located at the specified path;
            if (!File.Exists(fileWithPath)) {
                throw new FileNotFoundException($"The file '{fileWithPath}' does not exist.");
            }

            var serializer = new XmlSerializer(typeof(ComicInfo));
            using var stream = new FileStream(fileWithPath, FileMode.Open, FileAccess.Read);
            using var reader = new StreamReader(stream, Encoding.UTF8);
            var loadedComicInfo = (ComicInfo)serializer.Deserialize(reader);
            stream.Close();
            reader.Close();

            // Copy the deserialized values into the current instance
            if (loadedComicInfo != null) {
                Title = loadedComicInfo.Title;
                Series = loadedComicInfo.Series;
                Number = loadedComicInfo.Number;
                Count = loadedComicInfo.Count;
                Volume = loadedComicInfo.Volume;
                AlternateSeries = loadedComicInfo.AlternateSeries;
                AlternateNumber = loadedComicInfo.AlternateNumber;
                AlternateCount = loadedComicInfo.AlternateCount;
                Summary = loadedComicInfo.Summary;
                Notes = loadedComicInfo.Notes;
                Year = loadedComicInfo.Year;
                Month = loadedComicInfo.Month;
                Day = loadedComicInfo.Day;
                Writer = loadedComicInfo.Writer;
                Penciller = loadedComicInfo.Penciller;
                Inker = loadedComicInfo.Inker;
                Colorist = loadedComicInfo.Colorist;
                Letterer = loadedComicInfo.Letterer;
                CoverArtist = loadedComicInfo.CoverArtist;
                Editor = loadedComicInfo.Editor;
                Translator = loadedComicInfo.Translator;
                Publisher = loadedComicInfo.Publisher;
                Imprint = loadedComicInfo.Imprint;
                Genre = loadedComicInfo.Genre;
                Tags = loadedComicInfo.Tags;
                Web = loadedComicInfo.Web;
                PageCount = loadedComicInfo.PageCount;
                LanguageISO = loadedComicInfo.LanguageISO;
                Format = loadedComicInfo.Format;
                BlackAndWhite = loadedComicInfo.BlackAndWhite;
                Manga = loadedComicInfo.Manga;
                Characters = loadedComicInfo.Characters;
                MainCharacterOrTeam = loadedComicInfo.MainCharacterOrTeam;
                Teams = loadedComicInfo.Teams;
                Locations = loadedComicInfo.Locations;
                ScanInformation = loadedComicInfo.ScanInformation;
                StoryArc = loadedComicInfo.StoryArc;
                StoryArcNumber = loadedComicInfo.StoryArcNumber;
                SeriesGroup = loadedComicInfo.SeriesGroup;
                AgeRating = loadedComicInfo.AgeRating;
                CommunityRating = loadedComicInfo.CommunityRating;
                Review = loadedComicInfo.Review;
                Pages = loadedComicInfo.Pages;
                GTIN = loadedComicInfo.GTIN;
            }
        }
        catch (Exception e) {
            Console.WriteLine($"Error reading {fileWithPath}: {e}");
            return -1;
        }

        return 0;
    }

    #endregion Methods
}