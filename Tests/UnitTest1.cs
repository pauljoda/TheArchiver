using TheArchiver.DownloadWorker.Helpers;

namespace Tests;

public class Tests {
    [SetUp]
    public void Setup() {
        Environment.SetEnvironmentVariable("NotificationUrl", "https://notify.pauljoda.com/local");
    }

    [Test]
    public async Task NotificationTest() {
        var result = await NotificationHelper.SendNotification("Something Happened", "Something seemed to happen and this is letting you know", "file_cabinet");
        if(result)
            Assert.Pass();
        else 
            Assert.Fail();
    }
}