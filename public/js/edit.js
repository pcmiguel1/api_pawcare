window.onload = function () {

    const client = new window.HelloSign({
        clientId: '156d9bd2d04f4a46604a365cea400442'
      });
      
      // Get the current URL's query parameters
      const urlParams = new URLSearchParams(window.location.search);

      // Get the specific query parameters you need
      const editUrl = urlParams.get("edit_url");


      client.open(`${editUrl}`, {
        clientId: '156d9bd2d04f4a46604a365cea400442',
        skipDomainVerification: true,
        allowCancel: false
      });

      client.on('createTemplate', (data) => {
        console.log('The document has been signed!');
        Android.onSubmit();
      });

      client.on('cancel', (data) => {
        Android.onCancel();
      });

      client.on('close', (data) => {
        Android.onCancel();
      });
}