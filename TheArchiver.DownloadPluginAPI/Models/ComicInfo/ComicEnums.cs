using System.Xml.Serialization;

namespace TheArhiver.DownloadPluginAPI.Models.ComicInfo;

public class ComicEnums {
    
public enum YesNo {
    Unknown,
    No,
    Yes
}

public enum Manga {
    Unknown,
    No,
    Yes,
    YesAndRightToLeft
}

public enum AgeRating {
    Unknown,
    [XmlEnum("Adults Only 18+")] AdultsOnly18Plus,
    [XmlEnum("Early Childhood")] EarlyChildhood,
    Everyone,
    [XmlEnum("Everyone 10+")] Everyone10Plus,
    G,
    [XmlEnum("Kids to Adults")] KidsToAdults,
    M,
    [XmlEnum("MA15+")] MA15Plus,
    [XmlEnum("Mature 17+")] Mature17Plus,
    PG,
    [XmlEnum("R18+")] R18Plus,
    [XmlEnum("Rating Pending")] RatingPending,
    Teen,
    [XmlEnum("X18+")] X18Plus
}

[XmlType("ComicPageType")]
public enum ComicPageType {
    FrontCover,
    InnerCover,
    Roundup,
    Story,
    Advertisement,
    Editorial,
    Letters,
    Preview,
    BackCover,
    Other,
    Deleted
}
}