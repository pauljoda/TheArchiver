using System.Xml.Serialization;

namespace TheArhiver.DownloadPluginAPI.Models.ComicInfo;

public class ComicPageInfo {
    [XmlAttribute] public int Image { get; set; }

    [XmlAttribute] public ComicEnums.ComicPageType Type { get; set; } = ComicEnums.ComicPageType.Story;

    [XmlAttribute] public bool DoublePage { get; set; } = false;

    [XmlAttribute] public long ImageSize { get; set; } = 0;

    [XmlAttribute] public string Key { get; set; } = string.Empty;

    [XmlAttribute] public string Bookmark { get; set; } = string.Empty;

    [XmlAttribute] public int ImageWidth { get; set; } = -1;

    [XmlAttribute] public int ImageHeight { get; set; } = -1;
}